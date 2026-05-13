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
  deepseek: {
    label: 'DeepSeek',
    daily: 'deepseekDailyTokens',
    weekly: 'deepseekWeeklyTokens',
    lastDay: 'lastDeepSeekDayReset',
    lastWeek: 'lastDeepSeekWeekReset',
    dailyCost: 'deepseekDailyCostMicroCny',
    weeklyCost: 'deepseekWeeklyCostMicroCny',
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

function normalizeMiniMaxCounter(counter, update, dayStart, weekStart) {
  ensureCounterField(counter, update, 'minimaxDailyRequests', 0);
  ensureCounterField(counter, update, 'minimaxWeeklyRequests', 0);
  ensureCounterField(counter, update, 'lastMiniMaxDayReset', resolveResetDate(counter, 'lastMiniMaxDayReset', null, dayStart));
  ensureCounterField(counter, update, 'lastMiniMaxWeekReset', resolveResetDate(counter, 'lastMiniMaxWeekReset', null, weekStart));

  if (isBefore(counter.lastMiniMaxDayReset, dayStart)) {
    setCounterField(counter, update, 'minimaxDailyRequests', 0);
    setCounterField(counter, update, 'lastMiniMaxDayReset', dayStart);
  }

  if (isBefore(counter.lastMiniMaxWeekReset, weekStart)) {
    setCounterField(counter, update, 'minimaxWeeklyRequests', 0);
    setCounterField(counter, update, 'lastMiniMaxWeekReset', weekStart);
  }
}

function createInitialCounter(studentId, dayStart, weekStart) {
  return {
    studentId,
    dailyTokens: 0,
    weeklyTokens: 0,
    mimoDailyTokens: 0,
    mimoWeeklyTokens: 0,
    deepseekDailyTokens: 0,
    deepseekWeeklyTokens: 0,
    deepseekDailyCostMicroCny: 0,
    deepseekWeeklyCostMicroCny: 0,
    minimaxDailyRequests: 0,
    minimaxWeeklyRequests: 0,
    lastDayReset: dayStart,
    lastWeekReset: weekStart,
    lastMimoDayReset: dayStart,
    lastMimoWeekReset: weekStart,
    lastDeepSeekDayReset: dayStart,
    lastDeepSeekWeekReset: weekStart,
    lastMiniMaxDayReset: dayStart,
    lastMiniMaxWeekReset: weekStart,
  };
}

function normalizeCounter(counter, dayStart, weekStart) {
  const update = {};

  normalizeTokenProvider(counter, update, 'mimo', dayStart, weekStart);
  normalizeTokenProvider(counter, update, 'deepseek', dayStart, weekStart);
  normalizeMiniMaxCounter(counter, update, dayStart, weekStart);

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
  const dailyTokenLimit = Number.isInteger(Number(quota.dailyTokenLimit))
    ? Number(quota.dailyTokenLimit)
    : config.defaultQuota.dailyTokenLimit;
  const weeklyTokenLimit = Number.isInteger(Number(quota.weeklyTokenLimit))
    ? Number(quota.weeklyTokenLimit)
    : config.defaultQuota.weeklyTokenLimit;
  return { dailyTokenLimit, weeklyTokenLimit };
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
  const deepseek = getTokenUsage(counter, 'deepseek');

  return {
    dailyTokensUsed: mimo.dailyTokens,
    weeklyTokensUsed: mimo.weeklyTokens,
    mimoDailyTokensUsed: mimo.dailyTokens,
    mimoWeeklyTokensUsed: mimo.weeklyTokens,
    deepseekDailyTokensUsed: deepseek.dailyTokens,
    deepseekWeeklyTokensUsed: deepseek.weeklyTokens,
    deepseekDailyCostMicroCny: deepseek.dailyCostMicroCny,
    deepseekWeeklyCostMicroCny: deepseek.weeklyCostMicroCny,
    deepseekDailyCostCny: deepseek.dailyCostCny,
    deepseekWeeklyCostCny: deepseek.weeklyCostCny,
    minimaxDailyRequestsUsed: toCounterNumber(counter.minimaxDailyRequests),
    minimaxWeeklyRequestsUsed: toCounterNumber(counter.minimaxWeeklyRequests),
  };
}

async function checkTokenQuota(studentId, providerKey = 'mimo') {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const quota = getEffectiveTokenQuota(user.quota || config.defaultQuota);
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

function getMiniMaxRequestQuota() {
  return config.defaultMiniMaxQuota;
}

async function checkMiniMaxQuota(studentId, requestUnits = 1) {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const defaultQuota = getMiniMaxRequestQuota();
  const userQuota = user.quota || {};
  const dailyLimit = Number.isFinite(Number(userQuota.minimaxDailyRequestLimit))
    ? Number(userQuota.minimaxDailyRequestLimit)
    : defaultQuota.dailyRequestLimit;
  const weeklyLimit = Number.isFinite(Number(userQuota.minimaxWeeklyRequestLimit))
    ? Number(userQuota.minimaxWeeklyRequestLimit)
    : defaultQuota.weeklyRequestLimit;

  const counter = await getOrCreateCounter(studentId);
  const nextDaily = toCounterNumber(counter.minimaxDailyRequests) + requestUnits;
  const nextWeekly = toCounterNumber(counter.minimaxWeeklyRequests) + requestUnits;

  if (nextDaily > dailyLimit) {
    return { allowed: false, reason: `MiniMax 今日调用次数已用完（${dailyLimit} 次/日）` };
  }

  if (nextWeekly > weeklyLimit) {
    return { allowed: false, reason: `MiniMax 本周调用次数已用完（${weeklyLimit} 次/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: dailyLimit - toCounterNumber(counter.minimaxDailyRequests),
    weeklyRemaining: weeklyLimit - toCounterNumber(counter.minimaxWeeklyRequests),
  };
}

async function addMiniMaxRequests(studentId, requestUnits = 1) {
  if (!requestUnits || requestUnits <= 0) return;
  await getOrCreateCounter(studentId);
  await db.collection('token_counters')
    .where({ studentId })
    .update({
      minimaxDailyRequests: _.inc(requestUnits),
      minimaxWeeklyRequests: _.inc(requestUnits),
    });
}

function getDeepSeekCostQuota() {
  return config.defaultDeepSeekQuota;
}

async function checkDeepSeekCostQuota(studentId) {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const userQuota = user.quota || {};
  const defaultDsQuota = getDeepSeekCostQuota();
  const dailyLimit = Number.isFinite(Number(userQuota.deepseekDailyCostLimitCny))
    ? Number(userQuota.deepseekDailyCostLimitCny)
    : defaultDsQuota.dailyCostLimitCny;
  const weeklyLimit = Number.isFinite(Number(userQuota.deepseekWeeklyCostLimitCny))
    ? Number(userQuota.deepseekWeeklyCostLimitCny)
    : defaultDsQuota.weeklyCostLimitCny;

  const counter = await getOrCreateCounter(studentId);
  const usage = getTokenUsage(counter, 'deepseek');

  if (usage.dailyCostCny >= dailyLimit) {
    return { allowed: false, reason: `DeepSeek 今日金额额度已用完（¥${dailyLimit}/日）` };
  }

  if (usage.weeklyCostCny >= weeklyLimit) {
    return { allowed: false, reason: `DeepSeek 本周金额额度已用完（¥${weeklyLimit}/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: dailyLimit - usage.dailyCostCny,
    weeklyRemaining: weeklyLimit - usage.weeklyCostCny,
  };
}

module.exports = {
  addMiniMaxRequests,
  addTokenUsage,
  addTokens,
  checkDeepSeekCostQuota,
  checkMiniMaxQuota,
  checkQuota,
  checkTokenQuota,
  getDeepSeekCostQuota,
  getMiniMaxRequestQuota,
  getOrCreateCounter,
  getTokenUsage,
  getUsageSummary,
};
