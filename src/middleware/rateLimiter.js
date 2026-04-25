function createRateLimiter({ windowMs, max, keyGenerator }) {
  const records = new Map();
  let lastCleanup = Date.now();
  const cleanupInterval = Math.max(windowMs, 30 * 1000);

  function cleanup(now) {
    if (now - lastCleanup < cleanupInterval) return;
    lastCleanup = now;
    for (const [key, record] of records) {
      if (now - record.windowStart > windowMs) {
        records.delete(key);
      }
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    cleanup(now);

    const key = keyGenerator(req);
    const record = records.get(key);
    if (!record || now - record.windowStart > windowMs) {
      records.set(key, { count: 1, windowStart: now });
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试',
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
