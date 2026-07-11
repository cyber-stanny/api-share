/**
 * 初始化上游渠道配置
 * 使用方式：
 *   CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js
 *
 * 请先在环境变量中设置或在下方修改 API Key
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

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();

  const upstreams = UPSTREAM_PRESETS.map(preset => ({
    name: preset.name,
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    apiPath: preset.apiPath || null,
    apiKey: process.env[preset.apiKeyEnv] || `sk-xxx-${preset.apiKeyEnv.toLowerCase()}`,
    models: preset.models,
    protocol: preset.protocol,
    enabled: preset.enabled,
    priority: preset.priority,
    createdAt: new Date(),
  }));

  for (const u of upstreams) {
    const { data } = await db.collection('upstreams')
      .where({ name: u.name, protocol: u.protocol })
      .limit(1)
      .get();

    if (data && data.length > 0) {
      console.log(`已存在上游，跳过: ${u.name} (${u.models.join(', ')})`);
      continue;
    }

    await db.collection('upstreams').add(u);
    console.log(`已添加上游: ${u.name} (${u.models.join(', ')})`);
  }

  console.log('\n上游配置完成！');
  console.log('请在管理后台或数据库中修改 apiKey 为真实的 API Key');
}

main().catch(console.error);
