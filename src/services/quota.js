const { db, _ } = require('../db');
const config = require('../config');

// 每个 studentId 的互斥锁，防止并发创建重复计数器
const locks = new Map();

function getDayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
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

// 获取或初始化学生的 token 计数器
async function getOrCreateCounter(studentId) {
  return withLock(studentId, async () => {
    const dayStart = getDayStart();
    const weekStart = getWeekStart();

    const { data } = await db.collection('token_counters').where({ studentId }).limit(1).get();

    if (!data || data.length === 0) {
      // 创建前再查一次，防止并发重复
      const { data: recheck } = await db.collection('token_counters').where({ studentId }).limit(1).get();
      if (recheck && recheck.length > 0) {
        return recheck[0];
      }

      const counter = {
        studentId,
        dailyTokens: 0,
        weeklyTokens: 0,
        lastDayReset: dayStart,
        lastWeekReset: weekStart,
      };
      await db.collection('token_counters').add(counter);
      return counter;
    }

    const counter = data[0];
    let needsUpdate = false;

    if (!counter.lastDayReset || new Date(counter.lastDayReset) < dayStart) {
      counter.dailyTokens = 0;
      counter.lastDayReset = dayStart;
      needsUpdate = true;
    }

    if (!counter.lastWeekReset || new Date(counter.lastWeekReset) < weekStart) {
      counter.weeklyTokens = 0;
      counter.lastWeekReset = weekStart;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.collection('token_counters').doc(counter._id).update({
        dailyTokens: counter.dailyTokens,
        weeklyTokens: counter.weeklyTokens,
        lastDayReset: counter.lastDayReset,
        lastWeekReset: counter.lastWeekReset,
      });
    }

    return counter;
  });
}

// 检查学生是否还有额度
async function checkQuota(studentId) {
  const { data } = await db.collection('users').where({ studentId }).limit(1).get();
  if (!data || data.length === 0) {
    return { allowed: false, reason: '用户不存在' };
  }

  const user = data[0];
  const quota = user.quota || config.defaultQuota;

  const counter = await getOrCreateCounter(studentId);

  if (counter.dailyTokens >= quota.dailyTokenLimit) {
    return { allowed: false, reason: `今日 token 额度已用完（${quota.dailyTokenLimit} token/日）` };
  }

  if (counter.weeklyTokens >= quota.weeklyTokenLimit) {
    return { allowed: false, reason: `本周 token 额度已用完（${quota.weeklyTokenLimit} token/周）` };
  }

  return {
    allowed: true,
    dailyRemaining: quota.dailyTokenLimit - counter.dailyTokens,
    weeklyRemaining: quota.weeklyTokenLimit - counter.weeklyTokens,
  };
}

// 累加 token 用量
async function addTokens(studentId, totalTokens) {
  if (!totalTokens || totalTokens <= 0) return;

  // 确保计数器存在且已重置（如需要）
  await getOrCreateCounter(studentId);

  await db.collection('token_counters')
    .where({ studentId })
    .update({
      dailyTokens: _.inc(totalTokens),
      weeklyTokens: _.inc(totalTokens),
    });
}

module.exports = { checkQuota, addTokens };
