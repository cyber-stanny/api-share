/**
 * 初始化管理员账号
 * 使用方式：node scripts/init-admin.js
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');
const bcrypt = require('bcryptjs');

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  const password = process.env.ADMIN_INIT_PASSWORD || 'admin123';

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

  // 检查是否已有管理员
  const { data } = await db.collection('admins').limit(1).get();
  if (data && data.length > 0) {
    console.log('管理员账号已存在，跳过初始化');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection('admins').add({
    username: 'admin',
    passwordHash,
    createdAt: new Date(),
  });

  console.log('管理员账号创建成功');
  console.log('用户名: admin');
  console.log(`密码: ${password}`);
  console.log('请登录后尽快修改密码');
}

main().catch(console.error);
