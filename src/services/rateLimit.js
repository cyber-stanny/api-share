const config = require('../config');

// 内存限流（serverless 场景简化处理）
const requestCounts = new Map();
let concurrentRequests = 0;
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 30 * 1000;

function lazyCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, record] of requestCounts) {
    if (now - record.windowStart > config.rateLimit.windowMs) {
      requestCounts.delete(key);
    }
  }
}

function checkRateLimit(studentId) {
  lazyCleanup();
  const now = Date.now();
  const record = requestCounts.get(studentId);

  if (!record || now - record.windowStart > config.rateLimit.windowMs) {
    requestCounts.set(studentId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  record.count++;
  if (record.count > config.rateLimit.maxRequests) {
    return {
      allowed: false,
      reason: `请求频率超限，请稍后再试（${config.rateLimit.maxRequests} 次/分钟）`,
    };
  }

  return { allowed: true };
}

function acquireConcurrent() {
  if (concurrentRequests >= 100) {
    return false;
  }
  concurrentRequests++;
  return true;
}

function releaseConcurrent() {
  concurrentRequests = Math.max(0, concurrentRequests - 1);
}

module.exports = { checkRateLimit, acquireConcurrent, releaseConcurrent };
