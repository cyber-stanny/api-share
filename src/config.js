if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 环境变量未设置，请在 .env 或云函数配置中设置');
  process.exit(1);
}

if (!process.env.ADMIN_INIT_PASSWORD) {
  console.error('FATAL: ADMIN_INIT_PASSWORD 环境变量未设置，请在 .env 或云函数配置中设置');
  process.exit(1);
}

const config = {
  envId: process.env.CLOUDBASE_ENV_ID,
  jwtSecret: process.env.JWT_SECRET,
  adminInitPassword: process.env.ADMIN_INIT_PASSWORD,

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
    minimax: {
      maxConcurrent: parseInt(process.env.UPSTREAM_MINIMAX_MAX_CONCURRENT || process.env.UPSTREAM_MIMO_MAX_CONCURRENT || '8', 10),
      maxQueue: parseInt(process.env.UPSTREAM_MINIMAX_MAX_QUEUE || process.env.UPSTREAM_MIMO_MAX_QUEUE || '10', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_MINIMAX_QUEUE_TIMEOUT_MS || process.env.UPSTREAM_MIMO_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_MINIMAX_RPM || process.env.UPSTREAM_MIMO_RPM || '80', 10),
    },
    deepseek: {
      maxConcurrent: parseInt(process.env.UPSTREAM_DEEPSEEK_MAX_CONCURRENT || process.env.UPSTREAM_MIMO_MAX_CONCURRENT || '8', 10),
      maxQueue: parseInt(process.env.UPSTREAM_DEEPSEEK_MAX_QUEUE || process.env.UPSTREAM_MIMO_MAX_QUEUE || '10', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_DEEPSEEK_QUEUE_TIMEOUT_MS || process.env.UPSTREAM_MIMO_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_DEEPSEEK_RPM || process.env.UPSTREAM_MIMO_RPM || '80', 10),
    },
  },

  proxy: {
    enabled: process.env.PROXY_ENABLED !== 'false',
  },

  // 默认额度（按 token 计算）
  defaultQuota: {
    dailyTokenLimit: 500000,    // 每日 50 万 token
    weeklyTokenLimit: 2000000,  // 每周 200 万 token
  },

  // DeepSeek 默认额度（按人民币金额计算）
  defaultDeepSeekQuota: {
    dailyCostLimitCny: parseFloat(process.env.DEEPSEEK_DAILY_COST_LIMIT_CNY || '5'),
    weeklyCostLimitCny: parseFloat(process.env.DEEPSEEK_WEEKLY_COST_LIMIT_CNY || '20'),
  },

  // MiniMax 默认额度（按调用次数计算）
  defaultMiniMaxQuota: {
    dailyRequestLimit: parseInt(process.env.MINIMAX_DAILY_REQUEST_LIMIT || '1000', 10),
    weeklyRequestLimit: parseInt(process.env.MINIMAX_WEEKLY_REQUEST_LIMIT || '4000', 10),
  },
};

module.exports = config;
