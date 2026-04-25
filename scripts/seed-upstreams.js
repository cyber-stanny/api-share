/**
 * 初始化上游渠道配置
 * 使用方式：
 *   CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js
 *
 * 请先在环境变量中设置或在下方修改 API Key
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

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

  // 检查是否已有上游配置
  const { data } = await db.collection('upstreams').limit(1).get();
  if (data && data.length > 0) {
    console.log('上游配置已存在，如需重新配置请先清空 upstreams 集合');
    process.exit(0);
  }

  const mimoModels = [
    'mimo-v2.5-pro',
    'mimo-v2.5',
    'mimo-v2.5-tts-voiceclone',
    'mimo-v2.5-tts-voicedesign',
    'mimo-v2.5-tts',
    'mimo-v2-pro',
    'mimo-v2-omni',
    'mimo-v2-tts',
  ];

  const upstreams = [
    {
      name: 'Mimo (OpenAI)',
      baseUrl: 'https://token-plan-cn.xiaomimimo.com',
      apiKey: process.env.MIMO_API_KEY || 'sk-xxx-mimo-key',
      models: mimoModels,
      protocol: 'openai',
      enabled: true,
      priority: 10,
      createdAt: new Date(),
    },
    {
      name: 'Mimo (Anthropic)',
      baseUrl: 'https://token-plan-cn.xiaomimimo.com',
      apiKey: process.env.MIMO_API_KEY || 'sk-xxx-mimo-key',
      models: mimoModels,
      protocol: 'anthropic',
      enabled: true,
      priority: 10,
      createdAt: new Date(),
    },
  ];

  for (const u of upstreams) {
    await db.collection('upstreams').add(u);
    console.log(`已添加上游: ${u.name} (${u.models.join(', ')})`);
  }

  console.log('\n上游配置完成！');
  console.log('请在管理后台或数据库中修改 apiKey 为真实的 API Key');
}

main().catch(console.error);
