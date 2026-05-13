/**
 * Backfill usage_daily_stats from retained usage_records.
 *
 * Usage:
 *   node scripts/backfill-usage-daily-stats.js
 *   BACKFILL_BEFORE=2026-05-08T12:00:00+08:00 node scripts/backfill-usage-daily-stats.js
 *
 * The script writes only backfill* fields, so live counters can continue using
 * requests/successRequests/etc. Run it once after deploying the stats feature.
 */
require('dotenv').config();

const { db } = require('../src/db');
const {
  getBeijingDateKey,
  getBeijingMonthKey,
  getBeijingWeekKey,
} = require('../src/utils/dateParams');
const { getStatsKey } = require('../src/services/usageStats');

const PAGE_SIZE = 500;
const STATS_COLLECTION = 'usage_daily_stats';
const before = process.env.BACKFILL_BEFORE ? new Date(process.env.BACKFILL_BEFORE) : new Date();

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseCreatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addRecord(aggregates, record) {
  const createdAt = parseCreatedAt(record.createdAt);
  if (!createdAt || createdAt > before) return;

  const studentId = record.studentId;
  if (!studentId) return;

  const billingProvider = record.billingProvider || 'unknown';
  const model = record.model || '-';
  const dateKey = getBeijingDateKey(createdAt);
  const weekKey = getBeijingWeekKey(dateKey);
  const monthKey = getBeijingMonthKey(dateKey);
  const statsKey = getStatsKey({ studentId, dateKey, billingProvider, model });
  const status = Number(record.status || 0);
  const success = status > 0 && status < 400;

  if (!aggregates.has(statsKey)) {
    aggregates.set(statsKey, {
      statsKey,
      studentId,
      dateKey,
      weekKey,
      monthKey,
      billingProvider,
      model,
      backfillRequests: 0,
      backfillSuccessRequests: 0,
      backfillErrorRequests: 0,
      backfillTotalTokens: 0,
      backfillBillingUnits: 0,
      backfillBillingCostMicroCny: 0,
    });
  }

  const row = aggregates.get(statsKey);
  row.backfillRequests += 1;
  row.backfillSuccessRequests += success ? 1 : 0;
  row.backfillErrorRequests += success ? 0 : 1;
  row.backfillTotalTokens += toNumber(record.totalTokens);
  row.backfillBillingUnits += toNumber(record.billingUnits);
  row.backfillBillingCostMicroCny += Math.round(toNumber(record.billingCostMicroCny));
}

async function readUsageRecords() {
  const aggregates = new Map();
  let scanned = 0;

  for (let skip = 0; ; skip += PAGE_SIZE) {
    const { data } = await db.collection('usage_records')
      .where({ createdAt: db.command.lte(before) })
      .orderBy('createdAt', 'asc')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get();

    if (!data || data.length === 0) break;
    scanned += data.length;
    for (const record of data) addRecord(aggregates, record);
    if (data.length < PAGE_SIZE) break;
  }

  return { scanned, aggregates };
}

async function ensureStatsCollection() {
  try {
    await db.createCollection(STATS_COLLECTION);
    console.log(`Created collection: ${STATS_COLLECTION}`);
  } catch (err) {
    if (err.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw err;
    }
  }
}

async function writeAggregates(aggregates) {
  let created = 0;
  let updated = 0;
  const now = new Date();

  for (const row of aggregates.values()) {
    const payload = {
      ...row,
      backfillBillingCostCny: row.backfillBillingCostMicroCny / 1000000,
      backfilledAt: now,
      backfillBefore: before,
      updatedAt: now,
    };

    const { data } = await db.collection(STATS_COLLECTION)
      .where({ statsKey: row.statsKey })
      .limit(1)
      .get();

    if (data && data.length > 0) {
      await db.collection(STATS_COLLECTION).doc(data[0]._id).update(payload);
      updated += 1;
    } else {
      await db.collection(STATS_COLLECTION).add({
        ...payload,
        requests: 0,
        successRequests: 0,
        errorRequests: 0,
        totalTokens: 0,
        billingUnits: 0,
        billingCostMicroCny: 0,
        createdAt: now,
      });
      created += 1;
    }
  }

  return { created, updated };
}

async function main() {
  if (Number.isNaN(before.getTime())) {
    console.error('BACKFILL_BEFORE 必须是有效日期');
    process.exit(1);
  }

  console.log(`Backfill cutoff: ${before.toISOString()}`);
  await ensureStatsCollection();
  const { scanned, aggregates } = await readUsageRecords();
  const { created, updated } = await writeAggregates(aggregates);

  console.log(JSON.stringify({
    scannedUsageRecords: scanned,
    statsGroups: aggregates.size,
    created,
    updated,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
