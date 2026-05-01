const express = require('express');
const { apiKeyAuth } = require('../middleware/auth');
const { findUpstream, getAvailableModelDetails } = require('../services/upstream');
const { addTokenUsage, checkTokenQuota, checkDeepSeekCostQuota, checkMiniMaxQuota, addMiniMaxRequests } = require('../services/quota');
const { checkRateLimit, acquireConcurrent, releaseConcurrent } = require('../services/rateLimit');
const { acquireUpstreamSlot } = require('../services/upstreamLimiter');
const { recordUsage } = require('../services/usage');
const { createBillingContext, finalizeBilling } = require('../services/billing');

const router = express.Router();

function toUsageNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeOpenAIUsage(usage) {
  if (!usage) return null;
  const promptTokens = toUsageNumber(usage.prompt_tokens);
  const completionTokens = toUsageNumber(usage.completion_tokens);
  const totalTokens = toUsageNumber(usage.total_tokens) || promptTokens + completionTokens;
  const cacheHitTokens = toUsageNumber(
    usage.prompt_cache_hit_tokens
    ?? usage.prompt_tokens_details?.cached_tokens
    ?? usage.cached_prompt_tokens
  );
  const explicitCacheMissTokens = toUsageNumber(usage.prompt_cache_miss_tokens);

  return {
    ...usage,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cached_prompt_tokens: cacheHitTokens,
    prompt_cache_hit_tokens: cacheHitTokens,
    prompt_cache_miss_tokens: explicitCacheMissTokens || Math.max(0, promptTokens - cacheHitTokens),
  };
}

function normalizeAnthropicUsage(usage) {
  if (!usage) return null;
  const cacheCreationInputTokens = toUsageNumber(usage.cache_creation_input_tokens);
  const cacheReadInputTokens = toUsageNumber(usage.cache_read_input_tokens);
  const inputTokens = toUsageNumber(usage.input_tokens) + cacheCreationInputTokens + cacheReadInputTokens;
  const outputTokens = toUsageNumber(usage.output_tokens);

  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    cached_prompt_tokens: cacheReadInputTokens,
    prompt_cache_hit_tokens: cacheReadInputTokens,
    prompt_cache_miss_tokens: Math.max(0, inputTokens - cacheReadInputTokens),
  };
}

async function persistUsageAndBilling({
  studentId,
  model,
  billingModel,
  upstreamId,
  usage,
  status,
  billingContext,
}) {
  const billing = finalizeBilling(billingContext, billingModel || model, usage);
  await recordUsage({ studentId, model, upstreamId, usage, status, ...billing });
  if (billing.billingType === 'tokens' && (billing.billingUnits > 0 || billing.billingCostMicroCny > 0)) {
    try {
      await addTokenUsage(
        studentId,
        billing.billingProvider,
        billing.billingUnits,
        billing.billingCostMicroCny
      );
    } catch (err) {
      err.usageRecorded = true;
      throw err;
    }
  }
}

// 协议配置
const PROTOCOLS = {
  openai: {
    path: '/v1/chat/completions',
    headers: (apiKey) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
    prepareBody: (body, stream) => {
      const req = { ...body };
      if (stream) req.stream_options = { include_usage: true };
      return req;
    },
    errorMsg: (msg) => ({ error: { message: msg, type: 'api_error' } }),
    invalidRequestMsg: (msg) => ({ error: { message: msg, type: 'invalid_request_error' } }),
    rateLimitMsg: (msg) => ({ error: { message: msg, type: 'rate_limit_error' } }),
    createStreamUsageParser: () => (data) => normalizeOpenAIUsage(data.usage),
    parseNonStreamUsage: (data) => normalizeOpenAIUsage(data.usage),
  },
  anthropic: {
    path: '/v1/messages',
    headers: (apiKey) => ({ 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    prepareBody: (body) => body,
    errorMsg: (msg) => ({ type: 'error', error: { type: 'api_error', message: msg } }),
    invalidRequestMsg: (msg) => ({ type: 'error', error: { type: 'invalid_request_error', message: msg } }),
    rateLimitMsg: (msg) => ({ type: 'error', error: { type: 'rate_limit_error', message: msg } }),
    // 返回一个新的解析器工厂，每次请求创建独立实例避免并发冲突
    createStreamUsageParser: () => {
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheCreationInputTokens = 0;
      let cacheReadInputTokens = 0;
      return (data) => {
        if (data.type === 'message_start' && data.message?.usage) {
          inputTokens = data.message.usage.input_tokens || 0;
          cacheCreationInputTokens = data.message.usage.cache_creation_input_tokens || 0;
          cacheReadInputTokens = data.message.usage.cache_read_input_tokens || 0;
        }
        if (data.type === 'message_delta' && data.usage) {
          outputTokens = data.usage.output_tokens || 0;
        }
        const usage = normalizeAnthropicUsage({
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: cacheCreationInputTokens,
          cache_read_input_tokens: cacheReadInputTokens,
        });
        return usage?.total_tokens > 0 ? usage : null;
      };
    },
    parseNonStreamUsage: (data) => normalizeAnthropicUsage(data.usage),
  },
};

// 列出可用模型
router.get('/models', async (req, res) => {
  const models = await getAvailableModelDetails();
  res.json({
    object: 'list',
    data: models.map(model => ({
      id: model.id,
      object: 'model',
      owned_by: 'api-share',
    })),
  });
});

// 公共代理处理函数
async function handleProxy(req, res, protocol) {
  const proto = PROTOCOLS[protocol];
  const { model, stream } = req.body;

  if (!model) {
    return res.status(400).json(proto.invalidRequestMsg('缺少 model 参数'));
  }

  const rateResult = checkRateLimit(req.student.studentId);
  if (!rateResult.allowed) {
    res.set('Retry-After', '5');
    return res.status(429).json(proto.rateLimitMsg(rateResult.reason));
  }

  if (!acquireConcurrent()) {
    res.set('Retry-After', '10');
    return res.status(429).json(proto.rateLimitMsg('系统繁忙，请稍后再试'));
  }

  let upstream;
  let upstreamSlot = null;
  let released = false;
  let billingContext = null;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    releaseConcurrent();
  };

  try {
    upstream = await findUpstream(model, protocol);
    if (!upstream) {
      return res.status(404).json(proto.invalidRequestMsg(`模型 ${model} 不可用`));
    }

    billingContext = createBillingContext(upstream, model);
    if (billingContext.billingType === 'requests') {
      const quotaResult = await checkMiniMaxQuota(req.student.studentId, billingContext.billingUnits);
      if (!quotaResult.allowed) {
        res.set('Retry-After', '86400');
        return res.status(429).json(proto.rateLimitMsg(quotaResult.reason));
      }
    } else {
      const quotaResult = billingContext.billingProvider === 'deepseek'
        ? await checkDeepSeekCostQuota(req.student.studentId)
        : await checkTokenQuota(req.student.studentId, billingContext.billingProvider);
      if (!quotaResult.allowed) {
        res.set('Retry-After', '86400');
        return res.status(429).json(proto.rateLimitMsg(quotaResult.reason));
      }
    }

    upstreamSlot = await acquireUpstreamSlot(upstream);
    if (!upstreamSlot.allowed) {
      return res.status(429).json(proto.rateLimitMsg(upstreamSlot.reason || '上游繁忙，请稍后再试'));
    }

    if (billingContext.billingType === 'requests') {
      await addMiniMaxRequests(req.student.studentId, billingContext.billingUnits);
    }

    const requestBody = proto.prepareBody({ ...req.body }, stream);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let upstreamRes;
    try {
      upstreamRes = await fetch(`${upstream.baseUrl}${proto.path}`, {
        method: 'POST',
        headers: proto.headers(upstream.apiKey),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstreamRes.ok) {
      let errBody;
      try {
        errBody = await upstreamRes.json();
      } catch {
        errBody = proto.errorMsg('上游返回错误');
      }

      await persistUsageAndBilling({
        studentId: req.student.studentId,
        model,
        billingModel: model,
        upstreamId: upstream._id,
        usage: null,
        status: upstreamRes.status,
        billingContext,
      });

      return res.status(upstreamRes.status).json(errBody);
    }

    // Streaming 响应
    if (stream) {
      res.writeHead(upstreamRes.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let capturedUsage = null;
      let clientClosed = false;
      let streamStatus = 200;
      // 每次请求创建独立的 usage 解析器
      const parseStreamUsage = proto.createStreamUsageParser
        ? proto.createStreamUsageParser()
        : proto.parseStreamUsage;
      const onClose = () => {
        clientClosed = true;
        controller.abort();
        reader.cancel().catch(() => {});
      };
      res.on('close', onClose);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (clientClosed) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                const usage = parseStreamUsage(data);
                if (usage) capturedUsage = usage;
              } catch { /* ignore parse errors in SSE stream */ }
            }
          }
        }
      } catch (err) {
        streamStatus = clientClosed ? 499 : 502;
        console.error(`${protocol} stream error:`, err);
      } finally {
        res.off('close', onClose);
        if (!res.writableEnded) {
          res.end();
        }

        try {
          await persistUsageAndBilling({
            studentId: req.student.studentId,
            model,
            billingModel: model,
            upstreamId: upstream._id,
            usage: capturedUsage,
            status: streamStatus,
            billingContext,
          });
        } catch (err) {
          console.error('Failed to persist streaming usage:', {
            studentId: req.student.studentId,
            model,
            upstreamId: upstream._id,
            error: err.message,
          });
        }

        releaseOnce();
      }
      return;
    }

    // 非 streaming 响应
    const data = await upstreamRes.json();
    const usage = proto.parseNonStreamUsage(data);

    await persistUsageAndBilling({
        studentId: req.student.studentId,
        model: data.model || model,
        billingModel: model,
        upstreamId: upstream._id,
        usage,
        status: upstreamRes.status,
        billingContext,
      });

    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error(`${protocol} proxy error:`, err);

    if (!err.usageRecorded) {
      try {
        const billing = finalizeBilling(billingContext, model, null);
        await recordUsage({
          studentId: req.student.studentId,
          model,
          upstreamId: upstream?._id,
          usage: null,
          status: 502,
          ...billing,
        });
      } catch (usageErr) {
        console.error('Failed to record proxy error usage:', usageErr);
      }
    }

    if (!res.headersSent) {
      return res.status(502).json(proto.errorMsg('上游服务异常，请稍后再试'));
    }
    return undefined;
  } finally {
    upstreamSlot?.release?.();
    releaseOnce();
  }
}

// OpenAI 格式代理
router.post('/chat/completions', apiKeyAuth, (req, res) => handleProxy(req, res, 'openai'));

// Anthropic 格式代理
router.post('/messages', apiKeyAuth, (req, res) => handleProxy(req, res, 'anthropic'));

module.exports = router;
