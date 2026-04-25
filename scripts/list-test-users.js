/**
 * 列出所有 test 账户
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

  // 查找所有 studentId 包含 "test" 的用户
  const { data: users } = await db.collection('users')
    .where({ studentId: db.command.in(['test']) })  // 先试试
    .get();

  // 如果上面没结果，用更宽泛的方式
  let allUsers;
  if (!users || users.length === 0) {
    const result = await db.collection('users').limit(100).get();
    allUsers = result.data;
  } else {
    allUsers = users;
  }

  console.log(`\n数据库中共有 ${allUsers.length} 个用户：\n`);
  for (const u of allUsers) {
    const label = u.studentId.includes('test') ? ' [TEST]' : '';
    console.log(`  ${u.studentId}${label}  name=${u.name || '(无)'}  id=${u._id}`);
  }
}

main().catch(console.error);
