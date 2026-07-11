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
    aliyun: {
      maxConcurrent: parseInt(process.env.UPSTREAM_ALIYUN_MAX_CONCURRENT || process.env.UPSTREAM_MIMO_MAX_CONCURRENT || '8', 10),
      maxQueue: parseInt(process.env.UPSTREAM_ALIYUN_MAX_QUEUE || process.env.UPSTREAM_MIMO_MAX_QUEUE || '10', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_ALIYUN_QUEUE_TIMEOUT_MS || process.env.UPSTREAM_MIMO_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_ALIYUN_RPM || process.env.UPSTREAM_MIMO_RPM || '80', 10),
    },
    deepseek: {
      maxConcurrent: parseInt(process.env.UPSTREAM_DEEPSEEK_MAX_CONCURRENT || '100', 10),
      maxQueue: parseInt(process.env.UPSTREAM_DEEPSEEK_MAX_QUEUE || '100', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_DEEPSEEK_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_DEEPSEEK_RPM || '1000', 10),
    },
    glm: {
      maxConcurrent: parseInt(process.env.UPSTREAM_GLM_MAX_CONCURRENT || '20', 10),
      maxQueue: parseInt(process.env.UPSTREAM_GLM_MAX_QUEUE || '50', 10),
      queueTimeoutMs: parseInt(process.env.UPSTREAM_GLM_QUEUE_TIMEOUT_MS || '30000', 10),
      rpm: parseInt(process.env.UPSTREAM_GLM_RPM || '300', 10),
    },
  },

  proxy: {
    enabled: process.env.PROXY_ENABLED !== 'false',
  },

  // 默认额度（按 token 计算）
  defaultQuota: {
    dailyTokenLimit: 2000000,   // 每日 200 万 token
    weeklyTokenLimit: 8000000,  // 每周 800 万 token
    mimoDailyTokenLimit: 2000000,
    mimoWeeklyTokenLimit: 8000000,
    aliyunDailyTokenLimit: 2000000,
    aliyunWeeklyTokenLimit: 8000000,
    deepseekDailyCostLimitCny: parseFloat(process.env.DEEPSEEK_DAILY_COST_LIMIT_CNY || '5'),
    deepseekWeeklyCostLimitCny: parseFloat(process.env.DEEPSEEK_WEEKLY_COST_LIMIT_CNY || '20'),
    glmDailyCostLimitCny: parseFloat(process.env.GLM_DAILY_COST_LIMIT_CNY || '10'),
    glmWeeklyCostLimitCny: parseFloat(process.env.GLM_WEEKLY_COST_LIMIT_CNY || '50'),
  },

  // DeepSeek 默认额度（按人民币金额计算）
  defaultDeepSeekQuota: {
    dailyCostLimitCny: parseFloat(process.env.DEEPSEEK_DAILY_COST_LIMIT_CNY || '5'),
    weeklyCostLimitCny: parseFloat(process.env.DEEPSEEK_WEEKLY_COST_LIMIT_CNY || '20'),
  },
  defaultGlmQuota: {
    dailyCostLimitCny: parseFloat(process.env.GLM_DAILY_COST_LIMIT_CNY || '10'),
    weeklyCostLimitCny: parseFloat(process.env.GLM_WEEKLY_COST_LIMIT_CNY || '50'),
  },
};

module.exports = config;
