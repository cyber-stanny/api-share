/**
 * 将所有现有学生的 GLM 金额额度统一更新为当前环境配置。
 *
 * 默认只预览：npm run migrate:glm-quotas
 * 确认写入：  npm run migrate:glm-quotas:apply
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const shouldApply = process.argv.includes('--apply');
const dailyLimit = Number(process.env.GLM_DAILY_COST_LIMIT_CNY || 10);
const weeklyLimit = Number(process.env.GLM_WEEKLY_COST_LIMIT_CNY || 50);

async function listAllUsers(db) {
  const users = [];
  const batchSize = 100;
  while (true) {
    const { data = [] } = await db.collection('users')
      .skip(users.length)
      .limit(batchSize)
      .get();
    users.push(...data);
    if (data.length < batchSize) return users;
  }
}

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) throw new Error('请设置 CLOUDBASE_ENV_ID 环境变量');
  if (!Number.isFinite(dailyLimit) || dailyLimit < 0) throw new Error('GLM_DAILY_COST_LIMIT_CNY 必须是非负数字');
  if (!Number.isFinite(weeklyLimit) || weeklyLimit < dailyLimit) {
    throw new Error('GLM_WEEKLY_COST_LIMIT_CNY 必须是不小于每日额度的非负数字');
  }

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();
  const users = await listAllUsers(db);
  const pending = users.filter(user => (
    Number(user.quota?.glmDailyCostLimitCny) !== dailyLimit
    || Number(user.quota?.glmWeeklyCostLimitCny) !== weeklyLimit
  ));

  console.log(`学生共 ${users.length} 人，待更新 ${pending.length} 人，GLM 额度：¥${dailyLimit}/日、¥${weeklyLimit}/周。`);
  if (!shouldApply) {
    console.log('当前为预览模式；确认后使用 migrate:glm-quotas:apply 执行。');
    return;
  }

  for (const user of pending) {
    await db.collection('users').doc(user._id).update({
      'quota.glmDailyCostLimitCny': dailyLimit,
      'quota.glmWeeklyCostLimitCny': weeklyLimit,
    });
  }
  console.log(`更新完成：${pending.length} 人。`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
