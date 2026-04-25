const { db } = require('../db');

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
    .filter(u => u.models && u.models.includes(model) && (u.protocol || 'openai') === protocol)
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
  const upstreams = await getUpstreams();
  const modelSet = new Set();

  for (const u of upstreams) {
    if (protocol && (u.protocol || 'openai') !== protocol) continue;
    if (u.models) {
      for (const m of u.models) {
        modelSet.add(m);
      }
    }
  }

  return [...modelSet];
}

module.exports = { findUpstream, getAvailableModels, clearCache };
