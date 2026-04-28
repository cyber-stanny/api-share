/**
 * 将环境变量中的上游 API Key 同步到 CloudBase 的 upstreams 集合
 *
 * 用法：
 *   CLOUDBASE_ENV_ID=xxx MINIMAX_API_KEY=xxx node scripts/sync-upstream-keys.js
 *
 * 说明：
 * - 不会把密钥写入仓库，只更新数据库中的 upstream 记录
 * - 默认只同步 MiniMax 记录；如需扩展其他供应商，可复用同样模式
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!envId) {
    console.error('请设置 CLOUDBASE_ENV_ID 环境变量');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('请设置 MINIMAX_API_KEY 环境变量');
    process.exit(1);
  }

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();

  const { data } = await db.collection('upstreams').where({
    provider: 'MiniMax Token Plan',
  }).get();

  if (!data || data.length === 0) {
    console.log('未找到 MiniMax 上游记录，请先执行 scripts/seed-upstreams.js');
    return;
  }

  let updated = 0;
  for (const upstream of data) {
    await db.collection('upstreams').doc(upstream._id).update({
      apiKey,
      updatedAt: new Date(),
    });
    updated++;
    console.log(`已更新: ${upstream.name} (${upstream.protocol})`);
  }

  console.log(`\n同步完成，共更新 ${updated} 条 MiniMax 上游记录`);
}

main().catch((err) => {
  console.error('同步失败:', err);
  process.exit(1);
});
