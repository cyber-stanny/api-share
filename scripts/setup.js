/**
 * 一键初始化：创建所有数据库集合 + 管理员 + 上游配置
 * 使用方式：node scripts/setup.js
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');
const bcrypt = require('bcryptjs');

const COLLECTIONS = [
  'users',
  'admins',
  'whitelist',
  'upstreams',
  'usage_records',
  'token_counters',
];

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  const password = process.env.ADMIN_INIT_PASSWORD;
  if (!password) {
    console.error('错误: ADMIN_INIT_PASSWORD 环境变量未设置');
    process.exit(1);
  }

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

  // 1. 创建集合
  console.log('--- 创建数据库集合 ---');
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      console.log(`✓ ${name}`);
    } catch (err) {
      if (err.code === 'DATABASE_COLLECTION_ALREADY_EXISTS') {
        console.log(`- ${name} (已存在)`);
      } else {
        console.error(`✗ ${name}: ${err.message}`);
      }
    }
  }

  // 2. 初始化管理员
  console.log('\n--- 初始化管理员 ---');
  try {
    const { data } = await db.collection('admins').limit(1).get();
    if (data && data.length > 0) {
      console.log('管理员已存在，跳过');
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.collection('admins').add({
        username: 'admin',
        passwordHash,
        createdAt: new Date(),
      });
      console.log(`✓ 管理员创建成功 (admin / ${password})`);
    }
  } catch (err) {
    console.error('✗ 管理员初始化失败:', err.message);
  }

  // 3. 初始化上游配置
  console.log('\n--- 初始化上游配置 ---');
  try {
    const { data } = await db.collection('upstreams').limit(1).get();
    if (data && data.length > 0) {
      console.log('上游配置已存在，跳过');
    } else {
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
          apiKey: process.env.MIMO_API_KEY || 'sk-xxx',
          models: mimoModels,
          protocol: 'openai',
          enabled: true,
          priority: 10,
          createdAt: new Date(),
        },
        {
          name: 'Mimo (Anthropic)',
          baseUrl: 'https://token-plan-cn.xiaomimimo.com',
          apiKey: process.env.MIMO_API_KEY || 'sk-xxx',
          models: mimoModels,
          protocol: 'anthropic',
          enabled: true,
          priority: 10,
          createdAt: new Date(),
        },
      ];

      for (const u of upstreams) {
        await db.collection('upstreams').add(u);
        console.log(`✓ ${u.name} (${u.models.join(', ')})`);
      }
    }
  } catch (err) {
    console.error('✗ 上游配置失败:', err.message);
  }

  console.log('\n初始化完成！');
}

main().catch(console.error);
