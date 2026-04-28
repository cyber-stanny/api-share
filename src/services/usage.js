const { db } = require('../db');

const RETENTION_DAYS = 3;

// 异步记录调用日志（不阻塞响应）
async function recordUsage({ studentId, model, upstreamId, usage, status, billingType = 'tokens', billingUnits = 0 }) {
  try {
    await db.collection('usage_records').add({
      studentId,
      model,
      upstreamId: upstreamId || null,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      billingType,
      billingUnits,
      status,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('Failed to record usage:', err);
  }
}

// 清理过期日志（每次写入时有 1/100 概率触发，避免频繁查询）
async function cleanupOldRecords() {
  if (Math.random() > 0.01) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
    const { data } = await db.collection('usage_records')
      .where({ createdAt: db.command.lt(cutoff) })
      .orderBy('createdAt', 'asc')
      .limit(500)
      .get();
    if (!data || data.length === 0) return;
    const ids = data.map(r => r._id);
    await db.collection('usage_records').where({ _id: db.command.in(ids) }).remove();
    console.log(`Cleaned up ${ids.length} old usage records`);
  } catch (err) {
    console.error('Failed to cleanup usage records:', err);
  }
}

// 每次记录时概率性触发清理
async function recordUsageWithCleanup(params) {
  await recordUsage(params);
  cleanupOldRecords(); // fire-and-forget
}

module.exports = { recordUsage: recordUsageWithCleanup };
