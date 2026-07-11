const { db, _ } = require('../db');
const config = require('../config');
const { getBeijingDayStart, getBeijingWeekStart } = require('../utils/dateParams');

const locks = new Map();

const TOKEN_PROVIDERS = {
  mimo: {
    label: 'MiMo',
    daily: 'mimoDailyTokens',
    weekly: 'mimoWeeklyTokens',
    lastDay: 'lastMimoDayReset',
    lastWeek: 'lastMimoWeekReset',
    legacyDaily: 'dailyTokens',
    legacyWeekly: 'weeklyTokens',
    legacyLastDay: 'lastDayReset',
    legacyLastWeek: 'lastWeekReset',
  },
  aliyun: {
    label: 'Aliyun',
    daily: 'aliyunDailyTokens',
    weekly: 'aliyunWeeklyTokens',
    lastDay: 'lastAliyunDayReset',
    lastWeek: 'lastAliyunWeekReset',
  },
  deepseek: {
    label: 'DeepSeek',
    daily: 'deepseekDailyTokens',
    weekly: 'deepseekWeeklyTokens',
    lastDay: 'lastDeepseekDayReset',
    lastWeek: 'lastDeepseekWeekReset',
    legacyLastDay: 'lastDeepSeekDayReset',
    legacyLastWeek: 'lastDeepSeekWeekReset',
    dailyCost: 'deepseekDailyCostMicroCny',
    weeklyCost: 'deepseekWeeklyCostMicroCny',
  },
  glm: {
    label: 'GLM',
    daily: 'glmDailyTokens',
    weekly: 'glmWeeklyTokens',
    lastDay: 'lastGlmDayReset',
    lastWeek: 'lastGlmWeekReset',
    dailyCost: 'glmDailyCostMicroCny',
    weeklyCost: 'glmWeeklyCostMicroCny',
  },
};

function getDayStart() {
  return getBeijingDayStart();
}

function getWeekStart() {
  return getBeijingWeekStart();
}

function toCounterNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isValidDate(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function isBefore(value, boundary) {
  if (!isValidDate(value)) return true;
  return new Date(value) < boundary;
}

function resolveResetDate(counter, field, legacyField, fallback) {
  if (isValidDate(counter[field])) return counter[field];
  if (legacyField && isValidDate(counter[legacyField])) return counter[legacyField];
  return fallback;
}

function setCounterField(counter, update, field, value) {
  counter[field] = value;
  update[field] = value;
}

function ensureCounterField(counter, update, field, value) {
  if (counter[field] === undefined || counter[field] === null) {
    setCounterField(counter, update, field, value);
  }
}

async function withLock(key, fn) {
  while (locks.has(key)) {
    await locks.get(key);
  }
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  locks.set(key, promise);
  try {
    return await fn();
  } finally {
    locks.delete(key);
    resolve();
  }
}

function getProviderFields(providerKey) {
  return TOKEN_PROVIDERS[providerKey] || TOKEN_PROVIDERS.mimo;
}

function normalizeTokenProvider(counter, update, providerKey, dayStart, weekStart) {
  const fields = getProviderFields(providerKey);
  const dailySeed = fields.legacyDaily ? counter[fields.legacyDaily] : 0;
  const weeklySeed = fields.legacyWeekly ? counter[fields.legacyWeekly] : 0;

  ensureCounterField(counter, update, fields.daily, toCounterNumber(counter[fields.daily] ?? dailySeed));
  ensureCounterField(counter, update, fields.weekly, toCounterNumber(counter[fields.weekly] ?? weeklySeed));
  ensureCounterField(counter, update, fields.lastDay, resolveResetDate(counter, fields.lastDay, fields.legacyLastDay, dayStart));
  ensureCounterField(counter, update, fields.lastWeek, resolveResetDate(counter, fields.lastWeek, fields.legacyLastWeek, weekStart));

  if (fields.dailyCost) ensureCounterField(counter, update, fields.dailyCost, 0);
  if (fields.weeklyCost) ensureCounterField(counter, update, fields.weeklyCost, 0);

  if (fields.legacyDaily) {
    ensureCounterField(counter, update, fields.legacyDaily, toCounterNumber(counter[fields.daily]));
    ensureCounterField(counter, update, fields.legacyWeekly, toCounterNumber(counter[fields.weekly]));
    ensureCounterField(counter, update, fields.legacyLastDay, counter[fields.lastDay]);
    ensureCounterField(counter, update, fields.legacyLastWeek, counter[fields.lastWeek]);
  }

  if (isBefore(counter[fields.lastDay], dayStart)) {
    setCounterField(counter, update, fields.daily, 0);
    setCounterField(counter, update, fields.lastDay, dayStart);
    if (fields.dailyCost) setCounterField(counter, update, fields.dailyCost, 0);
    if (fields.legacyDaily) {
      setCounterField(counter, update, fields.legacyDaily, 0);
      setCounterField(counter, update, fields.legacyLastDay, dayStart);
    }
  }

  if (isBefore(counter[fields.lastWeek], weekStart)) {
    setCounterField(counter, update, fields.weekly, 0);
    setCounterField(counter, update, fields.lastWeek, weekStart);
    if (fields.weeklyCost) setCounterField(counter, update, fields.weeklyCost, 0);
    if (fields.legacyWeekly) {
      setCounterField(counter, update, fields.legacyWeekly, 0);
      setCounterField(counter, update, fields.legacyLastWeek, weekStart);
    }
  }
}

function createInitialCounter(studentId, dayStart, weekStart) {
  return {
    studentId,
    dailyTokens: 0,
    weeklyTokens: 0,
    mimoDailyTokens: 0,
    mimoWeeklyTokens: 0,
    aliyunDailyTokens: 0,
    aliyunWeeklyTokens: 0,
    deepseekDailyTokens: 0,
    deepseekWeeklyTokens: 0,
    deepseekDailyCostMicroCny: 0,
    deepseekWeeklyCostMicroCny: 0,
    glmDailyTokens: 0,
    glmWeeklyTokens: 0,
    glmDailyCostMicroCny: 0,
    glmWeeklyCostMicroCny: 0,
    lastDayReset: dayStart,
    lastWeekReset: weekStart,
    lastMimoDayReset: dayStart,
    lastMimoWeekReset: weekStart,
    lastAliyunDayReset: dayStart,
    lastAliyunWeekReset: weekStart,
    lastDeepseekDayReset: dayStart,
    lastDeepseekWeekReset: weekStart,
    lastDeepSeekDayReset: dayStart,
    lastDeepSeekWeekReset: weekStart,
    lastGlmDayReset: dayStart,
    lastGlmWeekReset: weekStart,
  };
}

function normalizeCounter(counter, dayStart, weekStart) {
  const update = {};

  normalizeTokenProvider(counter, update, 'mimo', dayStart, weekStart);
  normalizeTokenProvider(counter, update, 'aliyun', dayStart, weekStart);
  normalizeTokenProvider(counter, update, 'deepseek', dayStart, weekStart);
  normalizeTokenProvider(counter, update, 'glm', dayStart, weekStart);

  return update;
}

async function getOrCreateCounter(studentId) {
  return withLock(studentId, async () => {
    const dayStart = getDayStart();
    const weekStart = getWeekStart();

    const { data } = await db.collection('token_counters').where({ studentId }).limit(1).get();

    if (!data || data.length === 0) {
      const { data: recheck } = await db.collection('token_counters').where({ studentId }).limit(1).get();
      if (recheck && recheck.length > 0) {
        const existing = recheck[0];
        const update = normalizeCounter(existing, dayStart, weekStart);
        if (Object.keys(update).length > 0) {
          await db.collection('token_counters').doc(existing._id).update(update);
        }
        return existing;
      }

      const counter = createInitialCounter(studentId, dayStart, weekStart);
      await db.collection('token_counters').add(counter);
      return counter;
    }

    const counter = data[0];
    const update = normalizeCounter(counter, dayStart, weekStart);
    if (Object.keys(update).length > 0) {
      await db.collection('token_counters').doc(counter._id).update(update);
    }

    return counter;
  });
}

function getEffectiveTokenQuota(quota = {}) {
  const effectiveQuota = quota || {};
  const dailyTokenLimit = Number.isInteger(Number(effectiveQuota.dailyTokenLimit))
    ? Number(effectiveQuota.dailyTokenLimit)
    : config.defaultQuota.dailyTokenLimit;
  const weeklyTokenLimit = Number.isInteger(Number(effectiveQuota.weeklyTokenLimit))
    ? Number(effectiveQuota.weeklyTokenLimit)
    : config.defaultQuota.weeklyTokenLimit;
  const mimoDailyTokenLimit = Number.isInteger(Number(effectiveQuota.mimoDailyTokenLimit))
    ? Number(effectiveQuota.mimoDailyTokenLimit)
    : dailyTokenLimit;
  const mimoWeeklyTokenLimit = Number.isInteger(Number(effectiveQuota.mimoWeeklyTokenLimit))
    ? Number(effectiveQuota.mimoWeeklyTokenLimit)
    : weeklyTokenLimit;
  const aliyunDailyTokenLimit = Number.isInteger(Number(effectiveQuota.aliyunDailyTokenLimit))
    ? Number(effectiveQuota.aliyunDailyTokenLimit)
    : dailyTokenLimit;
  const aliyunWeeklyTokenLimit = Number.isInteger(Number(effectiveQuota.aliyunWeeklyTokenLimit))
    ? Number(effectiveQuota.aliyunWeeklyTokenLimit)
    : weeklyTokenLimit;
  const deepseekDailyCostLimitCny = Number.isFinite(Number(effectiveQuota.deepseekDailyCostLimitCny))
    ? Number(effectiveQuota.deepseekDailyCostLimitCny)
    : config.defaultDeepSeekQuota.dailyCostLimitCny;
  const deepseekWeeklyCostLimitCny = Number.isFinite(Number(effectiveQuota.deepseekWeeklyCostLimitCny))
    ? Number(effectiveQuota.deepseekWeeklyCostLimitCny)
    : config.defaultDeepSeekQuota.weeklyCostLimitCny;
  const glmDailyCostLimitCny = Number.isFinite(Number(effectiveQuota.glmDailyCostLimitCny))
    ? Number(effectiveQuota.glmDailyCostLimitCny)
    : config.defaultGlmQuota.dailyCostLimitCny;
  const glmWeeklyCostLimitCny = Number.isFinite(Number(effectiveQuota.glmWeeklyCostLimitCny))
    ? Number(effectiveQuota.glmWeeklyCostLimitCny)
    : config.defaultGlmQuota.weeklyCostLimitCny;

  return {
    dailyTokenLimit,
    weeklyTokenLimit,
    mimoDailyTokenLimit,
    mimoWeeklyTokenLimit,
    aliyunDailyTokenLimit,
    aliyunWeeklyTokenLimit,
    deepseekDailyCostLimitCny,
    deepseekWeeklyCostLimitCny,
    glmDailyCostLimitCny,
    glmWeeklyCostLimitCny,
  };
}

function getProviderTokenQuota(quota = {}, providerKey = 'mimo') {
  const effective = getEffectiveTokenQuota(quota);
  if (providerKey === 'aliyun') {
    return {
      dailyTokenLimit: effective.aliyunDailyTokenLimit,
      weeklyTokenLimit: effective.aliyunWeeklyTokenLimit,
    };
  }
  return {
    dailyTokenLimit: effective.mimoDailyTokenLimit,
    weeklyTokenLimit: effective.mimoWeeklyTokenLimit,
  };
}

function getTokenUsage(counter = {}, providerKey = 'mimo') {
  const fields = getProviderFields(providerKey);
  const dailyFallback = fields.legacyDaily ? counter[fields.legacyDaily] : 0;
  const weeklyFallback = fields.legacyWeekly ? counter[fields.legacyWeekly] : 0;
  const dailyCostMicroCny = toCounterNumber(fields.dailyCost ? counter[fields.dailyCost] : 0);
  const weeklyCostMicroCny = toCounterNumber(fields.weeklyCost ? counter[fields.weeklyCost] : 0);

  return {
    dailyTokens: toCounterNumber(counter[fields.daily] ?? dailyFallback),
    weeklyTokens: toCounterNumber(counter[fields.weekly] ?? weeklyFallback),
    dailyCostMicroCny,
    weeklyCostMicroCny,
    dailyCostCny: dailyCostMicroCny / 1000000,
    weeklyCostCny: weeklyCostMicroCny / 1000000,
  };
}

function getUsageSummary(counter = {}) {
  const mimo = getTokenUsage(counter, 'mimo');
  const aliyun = getTokenUsage(counter, 'aliyun');
  const deepseek = getTokenUsage(counter, 'deepseek');
  const glm = getTokenUsage(counter, 'glm');

  return {
    dailyTokensUsed: mimo.dailyTokens,
    weeklyTokensUsed: mimo.weeklyTokens,
    mimoDailyTokensUsed: mimo.dailyTokens,
    mimoWeeklyTokensUsed: mimo.weeklyTokens,
    aliyunDailyTokensUsed: aliyun.dailyTokens,
    aliyunWeeklyTokensUsed: aliyun.weeklyTokens,
    deepseekDailyTokensUsed: deepseek.dailyTokens,
    deepseekWeeklyTokensUsed: deepseek.weeklyTokens,
    deepseekDailyCostMicroCny: deepseek.dailyCostMicroCny,
    deepseekWeeklyCostMicroCny: deepseek.weeklyCostMicroCny,
    deepseekDailyCostCny: deepseek.dailyCostCny,
    deepseekWeeklyCostCny: deepseek.weeklyCostCny,
    glmDailyTokensUsed: glm.dailyTokens,
    glmWeeklyTokensUsed: glm.weeklyTokens,
    glmDailyCostMicroCny: glm.dailyCostMicroCny,
    glmWeeklyCostMicroCny: glm.weeklyCostMicroCny,
    glmDailyCostCny: glm.dailyCostCny,
    glmWeeklyCostCny: glm.weeklyCostCny,
  };
}

async function checkTokenQuota(studentId, providerKey = 'mimo') {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const quota = getProviderTokenQuota(user.quota || config.defaultQuota, providerKey);
  const counter = await getOrCreateCounter(studentId);
  const usage = getTokenUsage(counter, providerKey);
  const label = getProviderFields(providerKey).label;

  if (usage.dailyTokens >= quota.dailyTokenLimit) {
    return { allowed: false, reason: `${label} 今日 token 额度已用完（${quota.dailyTokenLimit} token/日）` };
  }

  if (usage.weeklyTokens >= quota.weeklyTokenLimit) {
    return { allowed: false, reason: `${label} 本周 token 额度已用完（${quota.weeklyTokenLimit} token/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: quota.dailyTokenLimit - usage.dailyTokens,
    weeklyRemaining: quota.weeklyTokenLimit - usage.weeklyTokens,
  };
}

function getDeepSeekCostQuota(quota = {}) {
  const effective = getEffectiveTokenQuota(quota);
  return {
    dailyCostLimitCny: effective.deepseekDailyCostLimitCny,
    weeklyCostLimitCny: effective.deepseekWeeklyCostLimitCny,
  };
}

async function checkDeepSeekCostQuota(studentId) {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const quota = getDeepSeekCostQuota(user.quota || config.defaultQuota);
  const counter = await getOrCreateCounter(studentId);
  const usage = getTokenUsage(counter, 'deepseek');

  if (usage.dailyCostCny >= quota.dailyCostLimitCny) {
    return { allowed: false, reason: `DeepSeek 今日金额额度已用完（¥${quota.dailyCostLimitCny}/日）` };
  }

  if (usage.weeklyCostCny >= quota.weeklyCostLimitCny) {
    return { allowed: false, reason: `DeepSeek 本周金额额度已用完（¥${quota.weeklyCostLimitCny}/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: quota.dailyCostLimitCny - usage.dailyCostCny,
    weeklyRemaining: quota.weeklyCostLimitCny - usage.weeklyCostCny,
  };
}

function getGlmCostQuota(quota = {}) {
  const effective = getEffectiveTokenQuota(quota);
  return {
    dailyCostLimitCny: effective.glmDailyCostLimitCny,
    weeklyCostLimitCny: effective.glmWeeklyCostLimitCny,
  };
}

async function checkGlmCostQuota(studentId) {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const quota = getGlmCostQuota(user.quota || config.defaultQuota);
  const counter = await getOrCreateCounter(studentId);
  const usage = getTokenUsage(counter, 'glm');

  if (usage.dailyCostCny >= quota.dailyCostLimitCny) {
    return { allowed: false, reason: `GLM 今日金额额度已用完（¥${quota.dailyCostLimitCny}/日）` };
  }
  if (usage.weeklyCostCny >= quota.weeklyCostLimitCny) {
    return { allowed: false, reason: `GLM 本周金额额度已用完（¥${quota.weeklyCostLimitCny}/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: quota.dailyCostLimitCny - usage.dailyCostCny,
    weeklyRemaining: quota.weeklyCostLimitCny - usage.weeklyCostCny,
  };
}

async function addTokenUsage(studentId, providerKey = 'mimo', totalTokens = 0, costMicroCny = 0) {
  const tokens = Math.ceil(toCounterNumber(totalTokens));
  const cost = Math.round(toCounterNumber(costMicroCny));
  if (tokens <= 0 && cost <= 0) return;

  await getOrCreateCounter(studentId);

  const fields = getProviderFields(providerKey);
  const update = {};
  if (tokens > 0) {
    update[fields.daily] = _.inc(tokens);
    update[fields.weekly] = _.inc(tokens);
    if (fields.legacyDaily) update[fields.legacyDaily] = _.inc(tokens);
    if (fields.legacyWeekly) update[fields.legacyWeekly] = _.inc(tokens);
  }
  if (cost > 0 && fields.dailyCost && fields.weeklyCost) {
    update[fields.dailyCost] = _.inc(cost);
    update[fields.weeklyCost] = _.inc(cost);
  }

  await db.collection('token_counters')
    .where({ studentId })
    .update(update);
}

async function checkQuota(studentId) {
  return checkTokenQuota(studentId, 'mimo');
}

async function addTokens(studentId, providerOrTokens, maybeTokens, maybeCostMicroCny = 0) {
  if (typeof providerOrTokens === 'string') {
    return addTokenUsage(studentId, providerOrTokens, maybeTokens, maybeCostMicroCny);
  }
  return addTokenUsage(studentId, 'mimo', providerOrTokens, maybeTokens || 0);
}

module.exports = {
  addTokenUsage,
  addTokens,
  checkDeepSeekCostQuota,
  checkGlmCostQuota,
  checkQuota,
  checkTokenQuota,
  getDeepSeekCostQuota,
  getGlmCostQuota,
  getEffectiveTokenQuota,
  getOrCreateCounter,
  getProviderTokenQuota,
  getTokenUsage,
  getUsageSummary,
};
