/**
 * Responses API <-> Chat Completions 翻译层
 *
 * 背景：OpenAI Codex 0.84+ 删除了 `wire_api = "chat"`，只发 Responses API
 * 请求（POST /v1/responses）。但上游（Aliyun Token Plan 等）的 OpenAI 兼容模式
 * 只有 Chat Completions。本模块把 Responses 请求翻译成 Chat 请求，再把 Chat
 * 响应（含流式 SSE）翻译回 Responses 格式。
 *
 * 纯函数 + 一个流式状态机，便于单测，不依赖任何 IO。
 */
const crypto = require('crypto');

function rid(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// 请求：Responses -> Chat Completions
// ---------------------------------------------------------------------------

// 把 Responses 的 content parts 转成 Chat 的 content。
// 纯文本场景合并为字符串；含图片则返回 Chat 的多模态数组。
function convertContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts = [];
  let hasImage = false;
  for (const p of content) {
    if (!p || typeof p !== 'object') continue;
    if (p.type === 'input_text' || p.type === 'output_text' || p.type === 'text') {
      parts.push({ type: 'text', text: p.text || '' });
    } else if (p.type === 'input_image') {
      hasImage = true;
      const url = typeof p.image_url === 'string' ? p.image_url : (p.image_url?.url || p.url);
      if (url) parts.push({ type: 'image_url', image_url: { url } });
    }
  }
  if (!hasImage) return parts.map(p => p.text).join('');
  return parts;
}

function convertTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  const out = [];
  for (const t of tools) {
    if (!t || t.type !== 'function') continue; // 内置工具（web_search 等）上游不认，丢弃
    const fn = t.function || t; // Responses 是扁平结构，Chat 是嵌套结构
    out.push({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters || { type: 'object', properties: {} },
        ...(fn.strict != null ? { strict: fn.strict } : {}),
      },
    });
  }
  return out.length ? out : undefined;
}

function responsesToChatRequest(body) {
  const messages = [];

  // instructions 是 Codex 放系统提示词的地方
  if (body.instructions && typeof body.instructions === 'string') {
    messages.push({ role: 'system', content: body.instructions });
  }

  const input = body.input;
  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const type = item.type || 'message';

      if (type === 'message') {
        let role = item.role || 'user';
        if (role === 'developer') role = 'system'; // 兼容只认 system 的上游
        messages.push({ role, content: convertContent(item.content) });
      } else if (type === 'function_call') {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: item.call_id || item.id,
            type: 'function',
            function: { name: item.name, arguments: item.arguments || '' },
          }],
        });
      } else if (type === 'function_call_output') {
        messages.push({
          role: 'tool',
          tool_call_id: item.call_id,
          content: typeof item.output === 'string' ? item.output : JSON.stringify(item.output),
        });
      }
      // 'reasoning' 等其它 item 类型直接忽略
    }
  }

  const chat = { model: body.model, messages };

  const tools = convertTools(body.tools);
  if (tools) chat.tools = tools;

  if (body.tool_choice != null) {
    const tc = body.tool_choice;
    if (tc && typeof tc === 'object' && tc.type === 'function' && tc.name) {
      chat.tool_choice = { type: 'function', function: { name: tc.name } };
    } else {
      chat.tool_choice = tc; // 'auto' | 'none' | 'required'
    }
  }
  if (body.parallel_tool_calls != null) chat.parallel_tool_calls = body.parallel_tool_calls;
  if (body.max_output_tokens != null) chat.max_tokens = body.max_output_tokens;
  if (body.temperature != null) chat.temperature = body.temperature;
  if (body.top_p != null) chat.top_p = body.top_p;
  if (body.stream) chat.stream = true;

  return chat;
}

// ---------------------------------------------------------------------------
// 响应：Chat usage -> Responses usage
// ---------------------------------------------------------------------------

function toResponsesUsage(u) {
  if (!u) return null;
  const input = u.prompt_tokens || 0;
  const output = u.completion_tokens || 0;
  return {
    input_tokens: input,
    input_tokens_details: { cached_tokens: u.prompt_tokens_details?.cached_tokens || 0 },
    output_tokens: output,
    output_tokens_details: { reasoning_tokens: u.completion_tokens_details?.reasoning_tokens || 0 },
    total_tokens: u.total_tokens || input + output,
  };
}

// ---------------------------------------------------------------------------
// 非流式响应：Chat Completions -> Responses
// ---------------------------------------------------------------------------

function chatToResponsesObject(chat, { model } = {}) {
  const choice = (chat.choices && chat.choices[0]) || {};
  const msg = choice.message || {};
  const output = [];

  if (msg.content) {
    output.push({
      type: 'message',
      id: rid('msg'),
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: msg.content, annotations: [] }],
    });
  }
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      output.push({
        type: 'function_call',
        id: rid('fc'),
        call_id: tc.id || rid('call'),
        name: tc.function?.name,
        arguments: tc.function?.arguments || '',
        status: 'completed',
      });
    }
  }

  const status = choice.finish_reason === 'length' ? 'incomplete' : 'completed';
  return {
    id: rid('resp'),
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status,
    error: null,
    incomplete_details: status === 'incomplete' ? { reason: 'max_output_tokens' } : null,
    model: chat.model || model,
    output,
    parallel_tool_calls: true,
    usage: toResponsesUsage(chat.usage),
  };
}

// ---------------------------------------------------------------------------
// 流式响应：Chat SSE chunks -> Responses SSE events（状态机）
//
// Chat 是 message 为中心（增量 delta），Responses 是 item 为中心（带命名事件）。
// 本类逐个吃入已解析的 Chat chunk，吐出待发送的 Responses 事件对象数组。
// 调用顺序：start() -> ingest(chunk)* -> finish()
// ---------------------------------------------------------------------------

class ChatToResponsesStream {
  constructor({ model } = {}) {
    this.model = model;
    this.seq = 0;
    this.responseId = rid('resp');
    this.createdAt = Math.floor(Date.now() / 1000);
    this.outputIndex = 0;

    this.message = null;          // { id, outputIndex, text }
    this.toolCalls = new Map();   // chatToolIndex -> { itemId, call_id, name, args, outputIndex }
    this.finishReason = null;
    this.rawUsage = null;         // 原始 Chat usage，用于计费
    this.responsesUsage = null;   // Responses 形态 usage，用于 completed 事件
  }

  _evt(type, extra) {
    return { type, sequence_number: this.seq++, ...extra };
  }

  _baseResponse(status, output) {
    return {
      id: this.responseId,
      object: 'response',
      created_at: this.createdAt,
      status,
      error: null,
      incomplete_details: null,
      model: this.model,
      output,
      parallel_tool_calls: true,
      usage: this.responsesUsage,
    };
  }

  start() {
    const response = this._baseResponse('in_progress', []);
    return [
      this._evt('response.created', { response }),
      this._evt('response.in_progress', { response }),
    ];
  }

  ingest(chunk) {
    const events = [];
    const choice = (chunk.choices && chunk.choices[0]) || {};
    const delta = choice.delta || {};

    if (delta.content) {
      if (!this.message) {
        this.message = { id: rid('msg'), outputIndex: this.outputIndex++, text: '' };
        events.push(this._evt('response.output_item.added', {
          output_index: this.message.outputIndex,
          item: { type: 'message', id: this.message.id, status: 'in_progress', role: 'assistant', content: [] },
        }));
        events.push(this._evt('response.content_part.added', {
          item_id: this.message.id,
          output_index: this.message.outputIndex,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [] },
        }));
      }
      this.message.text += delta.content;
      events.push(this._evt('response.output_text.delta', {
        item_id: this.message.id,
        output_index: this.message.outputIndex,
        content_index: 0,
        delta: delta.content,
      }));
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let entry = this.toolCalls.get(idx);
        if (!entry) {
          entry = {
            itemId: rid('fc'),
            call_id: tc.id || rid('call'),
            name: tc.function?.name || '',
            args: '',
            outputIndex: this.outputIndex++,
          };
          this.toolCalls.set(idx, entry);
          events.push(this._evt('response.output_item.added', {
            output_index: entry.outputIndex,
            item: { type: 'function_call', id: entry.itemId, call_id: entry.call_id, name: entry.name, arguments: '', status: 'in_progress' },
          }));
        }
        if (tc.id) entry.call_id = tc.id;
        if (tc.function?.name) entry.name = tc.function.name;
        if (tc.function?.arguments) {
          entry.args += tc.function.arguments;
          events.push(this._evt('response.function_call_arguments.delta', {
            item_id: entry.itemId,
            output_index: entry.outputIndex,
            delta: tc.function.arguments,
          }));
        }
      }
    }

    if (choice.finish_reason) this.finishReason = choice.finish_reason;
    if (chunk.usage) {
      this.rawUsage = chunk.usage;
      this.responsesUsage = toResponsesUsage(chunk.usage);
    }
    return events;
  }

  finish() {
    const events = [];
    const output = [];

    if (this.message) {
      events.push(this._evt('response.output_text.done', {
        item_id: this.message.id,
        output_index: this.message.outputIndex,
        content_index: 0,
        text: this.message.text,
      }));
      events.push(this._evt('response.content_part.done', {
        item_id: this.message.id,
        output_index: this.message.outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: this.message.text, annotations: [] },
      }));
      const item = {
        type: 'message', id: this.message.id, status: 'completed', role: 'assistant',
        content: [{ type: 'output_text', text: this.message.text, annotations: [] }],
      };
      events.push(this._evt('response.output_item.done', { output_index: this.message.outputIndex, item }));
      output.push(item);
    }

    for (const entry of [...this.toolCalls.values()].sort((a, b) => a.outputIndex - b.outputIndex)) {
      events.push(this._evt('response.function_call_arguments.done', {
        item_id: entry.itemId,
        output_index: entry.outputIndex,
        arguments: entry.args,
      }));
      const item = { type: 'function_call', id: entry.itemId, call_id: entry.call_id, name: entry.name, arguments: entry.args, status: 'completed' };
      events.push(this._evt('response.output_item.done', { output_index: entry.outputIndex, item }));
      output.push(item);
    }

    const status = this.finishReason === 'length' ? 'incomplete' : 'completed';
    const response = this._baseResponse(status, output);
    if (status === 'incomplete') response.incomplete_details = { reason: 'max_output_tokens' };
    events.push(this._evt('response.completed', { response }));
    return events;
  }

  failed(message) {
    const response = this._baseResponse('failed', []);
    response.error = { code: 'upstream_error', message };
    return this._evt('response.failed', { response });
  }

  getRawUsage() {
    return this.rawUsage;
  }
}

// 把单个 Responses 事件对象写成 SSE 帧（含 event: 行，Codex 按 event 类型分发）
function serializeResponsesEvent(evt) {
  return `event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;
}

module.exports = {
  responsesToChatRequest,
  chatToResponsesObject,
  toResponsesUsage,
  ChatToResponsesStream,
  serializeResponsesEvent,
};
