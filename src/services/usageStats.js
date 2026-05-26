const crypto = require('crypto');
const { db, _ } = require('../db');
const {
  getBeijingDateKey,
  getBeijingMonthKey,
  getBeijingWeekKey,
} = require('../utils/dateParams');

const MAX_STATS_ROWS = 10000;
const ALLOWED_GROUPS = new Set(['day', 'week', 'month', 'all']);

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getStatsKey({ studentId, dateKey, billingProvider, model }) {
  return crypto
    .createHash('sha1')
    .update([studentId, dateKey, billingProvider || '-', model || '-'].join('\0'))
    .digest('hex');
}

function createEmptyStatsRow(periodKey, label) {
  return {
    periodKey,
    label,
    requests: 0,
    successRequests: 0,
    errorRequests: 0,
    totalTokens: 0,
    billingUnits: 0,
    billingCostMicroCny: 0,
    billingCostCny: 0,
  };
}

function addStats(target, row) {
  target.requests += toNumber(row.requests) + toNumber(row.backfillRequests);
  target.successRequests += toNumber(row.successRequests) + toNumber(row.backfillSuccessRequests);
  target.errorRequests += toNumber(row.errorRequests) + toNumber(row.backfillErrorRequests);
  target.totalTokens += toNumber(row.totalTokens) + toNumber(row.backfillTotalTokens);
  target.billingUnits += toNumber(row.billingUnits) + toNumber(row.backfillBillingUnits);
  target.billingCostMicroCny += toNumber(row.billingCostMicroCny) + toNumber(row.backfillBillingCostMicroCny);
  target.billingCostCny = target.billingCostMicroCny / 1000000;
}

function getPeriodKey(row, groupBy) {
  if (groupBy === 'week') return row.weekKey || getBeijingWeekKey(row.dateKey);
  if (groupBy === 'month') return row.monthKey || getBeijingMonthKey(row.dateKey);
  if (groupBy === 'all') return 'all';
  return row.dateKey;
}

function getPeriodLabel(periodKey, groupBy) {
  if (groupBy === 'all') return '累计';
  if (groupBy === 'week') return `${periodKey} 周`;
  return periodKey;
}

async function incrementDailyUsageStats({
  studentId,
  model,
  usage,
  status,
  billingProvider = null,
  billingUnits = 0,
  billingCostMicroCny = 0,
  createdAt = new Date(),
}) {
  if (!studentId) return;

  const provider = billingProvider || 'unknown';
  const modelName = model || '-';
  const dateKey = getBeijingDateKey(createdAt);
  const weekKey = getBeijingWeekKey(dateKey);
  const monthKey = getBeijingMonthKey(dateKey);
  const statsKey = getStatsKey({ studentId, dateKey, billingProvider: provider, model: modelName });
  const statusCode = Number(status || 0);
  const success = statusCode > 0 && statusCode < 400;
  const cost = Math.round(toNumber(billingCostMicroCny));
  const now = new Date();

  const update = {
    requests: _.inc(1),
    successRequests: _.inc(success ? 1 : 0),
    errorRequests: _.inc(success ? 0 : 1),
    totalTokens: _.inc(toNumber(usage?.total_tokens)),
    billingUnits: _.inc(toNumber(billingUnits)),
    billingCostMicroCny: _.inc(cost),
    updatedAt: now,
  };

  const { data } = await db.collection('usage_daily_stats')
    .where({ statsKey })
    .limit(1)
    .get();

  if (data && data.length > 0) {
    await db.collection('usage_daily_stats').doc(data[0]._id).update(update);
    return;
  }

  await db.collection('usage_daily_stats').add({
    statsKey,
    studentId,
    dateKey,
    weekKey,
    monthKey,
    billingProvider: provider,
    model: modelName,
    requests: 1,
    successRequests: success ? 1 : 0,
    errorRequests: success ? 0 : 1,
    totalTokens: toNumber(usage?.total_tokens),
    billingUnits: toNumber(billingUnits),
    billingCostMicroCny: cost,
    createdAt: now,
    updatedAt: now,
  });
}

async function fetchDailyStats({ studentId, provider, model, startDate, endDate }) {
  const conditions = [];
  if (studentId) conditions.push({ studentId });
  if (provider) conditions.push({ billingProvider: provider });
  if (model) conditions.push({ model });
  if (startDate) conditions.push({ dateKey: _.gte(getBeijingDateKey(startDate)) });
  if (endDate) conditions.push({ dateKey: _.lte(getBeijingDateKey(endDate)) });

  const where = conditions.length > 0 ? _.and(...conditions) : {};
  const rows = [];
  const pageSize = 500;

  for (let skip = 0; skip < MAX_STATS_ROWS; skip += pageSize) {
    const { data } = await db.collection('usage_daily_stats')
      .where(where)
      .orderBy('dateKey', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return {
    rows,
    truncated: rows.length >= MAX_STATS_ROWS,
  };
}

async function queryUsageStats({
  studentId,
  provider,
  model,
  startDate,
  endDate,
  groupBy = 'day',
}) {
  const nextGroupBy = ALLOWED_GROUPS.has(groupBy) ? groupBy : 'day';
  const { rows: dailyRows, truncated } = await fetchDailyStats({ studentId, provider, model, startDate, endDate });
  const grouped = new Map();
  const summary = createEmptyStatsRow('all', '累计');
  let firstDateKey = null;
  let lastDateKey = null;

  for (const row of dailyRows) {
    const periodKey = getPeriodKey(row, nextGroupBy);
    if (!grouped.has(periodKey)) {
      grouped.set(periodKey, createEmptyStatsRow(periodKey, getPeriodLabel(periodKey, nextGroupBy)));
    }
    addStats(grouped.get(periodKey), row);
    addStats(summary, row);

    if (!firstDateKey || row.dateKey < firstDateKey) firstDateKey = row.dateKey;
    if (!lastDateKey || row.dateKey > lastDateKey) lastDateKey = row.dateKey;
  }

  const groupedRows = [...grouped.values()].sort((a, b) => {
    if (nextGroupBy === 'all') return 0;
    return a.periodKey < b.periodKey ? 1 : -1;
  });

  return {
    groupBy: nextGroupBy,
    rows: groupedRows,
    summary,
    firstDateKey,
    lastDateKey,
    truncated,
  };
}

async function queryStudentUsageSummary({ startDate, endDate }) {
  const { rows: dailyRows, truncated } = await fetchDailyStats({ startDate, endDate });

  const studentMap = new Map();

  for (const row of dailyRows) {
    const sid = row.studentId;
    if (!studentMap.has(sid)) {
      studentMap.set(sid, {
        studentId: sid,
        requests: 0,
        successRequests: 0,
        errorRequests: 0,
        totalTokens: 0,
        billingUnits: 0,
        billingCostMicroCny: 0,
        models: new Map(),
      });
    }
    const student = studentMap.get(sid);
    const tokens = toNumber(row.totalTokens) + toNumber(row.backfillTotalTokens);
    const reqs = toNumber(row.requests) + toNumber(row.backfillRequests);
    const successReqs = toNumber(row.successRequests) + toNumber(row.backfillSuccessRequests);
    const errorReqs = toNumber(row.errorRequests) + toNumber(row.backfillErrorRequests);
    const units = toNumber(row.billingUnits) + toNumber(row.backfillBillingUnits);
    const costMicro = toNumber(row.billingCostMicroCny) + toNumber(row.backfillBillingCostMicroCny);

    student.requests += reqs;
    student.successRequests += successReqs;
    student.errorRequests += errorReqs;
    student.totalTokens += tokens;
    student.billingUnits += units;
    student.billingCostMicroCny += costMicro;

    const modelName = row.model || '-';
    if (!student.models.has(modelName)) {
      student.models.set(modelName, {
        model: modelName,
        requests: 0,
        successRequests: 0,
        errorRequests: 0,
        totalTokens: 0,
        billingUnits: 0,
        billingCostMicroCny: 0,
      });
    }
    const modelStats = student.models.get(modelName);
    modelStats.requests += reqs;
    modelStats.successRequests += successReqs;
    modelStats.errorRequests += errorReqs;
    modelStats.totalTokens += tokens;
    modelStats.billingUnits += units;
    modelStats.billingCostMicroCny += costMicro;
  }

  const students = [...studentMap.values()]
    .map(s => ({
      ...s,
      billingCostCny: s.billingCostMicroCny / 1000000,
      models: [...s.models.values()]
        .map(m => ({ ...m, billingCostCny: m.billingCostMicroCny / 1000000 }))
        .sort((a, b) => b.totalTokens - a.totalTokens),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return { students, truncated };
}

module.exports = {
  getStatsKey,
  incrementDailyUsageStats,
  queryUsageStats,
  queryStudentUsageSummary,
};
