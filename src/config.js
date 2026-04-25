if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 环境变量未设置，请在 .env 或云函数配置中设置');
  process.exit(1);
}

const config = {
  envId: process.env.CLOUDBASE_ENV_ID,
  jwtSecret: process.env.JWT_SECRET,
  adminInitPassword: process.env.ADMIN_INIT_PASSWORD || 'admin123',

  // 限流配置
  rateLimit: {
    windowMs: 60 * 1000,  // 1 分钟窗口
    maxRequests: 60,       // 每分钟最多 60 次请求
  },

  upstreamLimits: {
    mimo: {
      maxConcurrent: parseInt(process.env.UPSTREAM_MIMO_MAX_CONCURRENT || '8', 10),
      maxQueue: parseInt(process.env.UPSTREAM_MIMO_MAX_QUEUE || '10', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_MIMO_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_MIMO_RPM || '80', 10),
    },
  },

  // 默认额度（按 token 计算）
  defaultQuota: {
    dailyTokenLimit: 500000,    // 每日 50 万 token
    weeklyTokenLimit: 2000000,  // 每周 200 万 token
  },
};

module.exports = config;
