/**
 * 将环境变量中的上游 API Key 同步到 CloudBase 的 upstreams 集合
 *
 * 用法：
 *   CLOUDBASE_ENV_ID=xxx DEEPSEEK_API_KEY=xxx node scripts/sync-upstream-keys.js
 *
 * 说明：
 * - 不会把密钥写入仓库，只更新数据库中的 upstream 记录
 * - 会同步当前环境变量中已设置的 MiMo / Aliyun / DeepSeek Key
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');
const { UPSTREAM_PRESETS } = require('../src/services/modelCatalog');

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;

  if (!envId) {
    console.error('请设置 CLOUDBASE_ENV_ID 环境变量');
    process.exit(1);
  }

  const syncPresets = [];
  for (const preset of UPSTREAM_PRESETS) {
    const apiKey = process.env[preset.apiKeyEnv];
    if (apiKey) {
      syncPresets.push({
        name: preset.name,
        protocol: preset.protocol,
        provider: preset.provider,
        apiKey,
        envName: preset.apiKeyEnv,
      });
    }
  }

  if (syncPresets.length === 0) {
    console.error('请至少设置一个上游 Key 环境变量：MIMO_API_KEY / ALIYUN_API_KEY / DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();

  let totalUpdated = 0;
  for (const { name, protocol, provider, apiKey, envName } of syncPresets) {
    const { data } = await db.collection('upstreams')
      .where({ name, protocol })
      .limit(1)
      .get();

    if (!data || data.length === 0) {
      console.log(`未找到 ${name} (${protocol}) 上游记录，请先执行 scripts/seed-upstreams.js`);
      continue;
    }

    const upstream = data[0];
    await db.collection('upstreams').doc(upstream._id).update({
      apiKey,
      provider: upstream.provider || provider,
      updatedAt: new Date(),
    });
    totalUpdated++;
    console.log(`已更新: ${upstream.name} (${upstream.protocol}) <- ${envName}`);
  }

  console.log(`\n同步完成，共更新 ${totalUpdated} 条上游记录`);
}

main().catch((err) => {
  console.error('同步失败:', err);
  process.exit(1);
});
