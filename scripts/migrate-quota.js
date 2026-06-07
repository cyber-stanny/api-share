/**
 * 批量更新学生额度：按供应商拆分 quota，并保证新额度高于当前已用量。
 *
 * 用法：
 *   node scripts/migrate-quota.js            # 预览（dry-run）
 *   node scripts/migrate-quota.js --apply    # 实际执行
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');
const config = require('../src/config');
const {
  getEffectiveTokenQuota,
  getTokenUsage,
} = require('../src/services/quota');

const DRY_RUN = !process.argv.includes('--apply');
const TOKEN_HEADROOM = 1;
const COST_HEADROOM_CNY = 0.01;

function nextTokenLimit(defaultLimit, used) {
  return Math.max(Number(defaultLimit || 0), Math.ceil(Number(used || 0) + TOKEN_HEADROOM));
}

function nextCostLimit(defaultLimit, used) {
  return Math.max(Number(defaultLimit || 0), Number((Number(used || 0) + COST_HEADROOM_CNY).toFixed(2)));
}

function quotaChanged(current, next) {
  return Object.keys(next).some(key => Number(current[key]) !== Number(next[key]));
}

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) {
    console.error('请设置 CLOUDBASE_ENV_ID 环境变量');
    process.exit(1);
  }

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();

  const { data: users } = await db.collection('users')
    .where({})
    .limit(1000)
    .get();

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const { data: counters } = await db.collection('token_counters')
      .where({ studentId: user.studentId })
      .limit(1)
      .get();
    const counter = counters?.[0] || {};
    const mimoUsage = getTokenUsage(counter, 'mimo');
    const aliyunUsage = getTokenUsage(counter, 'aliyun');
    const deepseekUsage = getTokenUsage(counter, 'deepseek');
    const currentQuota = getEffectiveTokenQuota(user.quota || config.defaultQuota);
    const nextQuota = {
      ...currentQuota,
      dailyTokenLimit: nextTokenLimit(config.defaultQuota.dailyTokenLimit, mimoUsage.dailyTokens),
      weeklyTokenLimit: nextTokenLimit(config.defaultQuota.weeklyTokenLimit, mimoUsage.weeklyTokens),
      mimoDailyTokenLimit: nextTokenLimit(config.defaultQuota.mimoDailyTokenLimit, mimoUsage.dailyTokens),
      mimoWeeklyTokenLimit: nextTokenLimit(config.defaultQuota.mimoWeeklyTokenLimit, mimoUsage.weeklyTokens),
      aliyunDailyTokenLimit: nextTokenLimit(config.defaultQuota.aliyunDailyTokenLimit, aliyunUsage.dailyTokens),
      aliyunWeeklyTokenLimit: nextTokenLimit(config.defaultQuota.aliyunWeeklyTokenLimit, aliyunUsage.weeklyTokens),
      deepseekDailyCostLimitCny: nextCostLimit(
        config.defaultDeepSeekQuota.dailyCostLimitCny,
        deepseekUsage.dailyCostCny
      ),
      deepseekWeeklyCostLimitCny: nextCostLimit(
        config.defaultDeepSeekQuota.weeklyCostLimitCny,
        deepseekUsage.weeklyCostCny
      ),
    };

    if (!quotaChanged(currentQuota, nextQuota)) {
      skipped++;
      continue;
    }

    const summary = [
      `mimo ${currentQuota.mimoDailyTokenLimit}/${currentQuota.mimoWeeklyTokenLimit} -> ${nextQuota.mimoDailyTokenLimit}/${nextQuota.mimoWeeklyTokenLimit}`,
      `aliyun ${currentQuota.aliyunDailyTokenLimit}/${currentQuota.aliyunWeeklyTokenLimit} -> ${nextQuota.aliyunDailyTokenLimit}/${nextQuota.aliyunWeeklyTokenLimit}`,
      `deepseek ¥${currentQuota.deepseekDailyCostLimitCny}/¥${currentQuota.deepseekWeeklyCostLimitCny} -> ¥${nextQuota.deepseekDailyCostLimitCny}/¥${nextQuota.deepseekWeeklyCostLimitCny}`,
    ].join(', ');

    if (DRY_RUN) {
      console.log(`[DRY-RUN] ${user.studentId}: ${summary}`);
    } else {
      await db.collection('users').doc(user._id).update({ quota: nextQuota });
      console.log(`[UPDATED] ${user.studentId}: ${summary}`);
    }
    updated++;
  }

  console.log(`\n总计: ${users.length} 用户, ${updated} 需更新, ${skipped} 已是最新`);
  if (DRY_RUN) console.log('（预览模式，加 --apply 执行）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
