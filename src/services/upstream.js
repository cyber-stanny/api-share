const { db } = require('../db');
const { MODEL_ORDER, getModelMetadata, isTextModelSupported } = require('./modelCatalog');

// 缓存上游配置（避免每次请求都查库）
let cache = { data: null, time: 0 };
const CACHE_TTL = 60 * 1000; // 1 分钟

async function getUpstreams() {
  const now = Date.now();
  if (cache.data && now - cache.time < CACHE_TTL) {
    return cache.data;
  }

  const { data } = await db.collection('upstreams').where({ enabled: true }).get();
  cache = { data, time: now };
  return data;
}

function clearCache() {
  cache = { data: null, time: 0 };
}

async function findUpstream(model, protocol = 'openai') {
  const upstreams = await getUpstreams();

  // 找到支持该模型和协议的所有上游，按 priority 降序
  const candidates = upstreams
    .filter(u => isTextModelSupported(model) && u.models && u.models.includes(model) && (u.protocol || 'openai') === protocol)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (candidates.length === 0) {
    return null;
  }

  // 优先级最高的组中随机选一个
  const topPriority = candidates[0].priority;
  const top = candidates.filter(u => u.priority === topPriority);
  return top[Math.floor(Math.random() * top.length)];
}

async function getAvailableModels(protocol) {
  const models = await getAvailableModelDetails(protocol);
  return models.map(model => model.id);
}

async function getAvailableModelDetails(protocol) {
  const upstreams = await getUpstreams();
  const modelMap = new Map();

  for (const upstream of upstreams) {
    if (protocol && (upstream.protocol || 'openai') !== protocol) continue;
    if (!Array.isArray(upstream.models)) continue;

    for (const modelId of upstream.models) {
      if (!isTextModelSupported(modelId)) continue;
      const meta = getModelMetadata(modelId);
      const existing = modelMap.get(modelId) || {
        id: modelId,
        name: modelId,
        provider: upstream.provider || meta.provider || upstream.name || 'API Share',
        protocols: new Set(),
      };

      existing.provider = existing.provider || upstream.provider || meta.provider || upstream.name || 'API Share';
      existing.protocols.add(upstream.protocol || 'openai');
      modelMap.set(modelId, existing);
    }
  }

  return [...modelMap.values()]
    .sort((a, b) => {
      const ai = MODEL_ORDER.indexOf(a.id);
      const bi = MODEL_ORDER.indexOf(b.id);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.id.localeCompare(b.id);
    })
    .map(item => ({
      id: item.id,
      name: item.name,
      provider: item.provider,
      protocols: [...item.protocols].sort((a, b) => {
        const order = { openai: 0, anthropic: 1 };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    }));
}

module.exports = { findUpstream, getAvailableModels, getAvailableModelDetails, clearCache };
