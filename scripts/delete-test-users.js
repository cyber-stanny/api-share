/**
 * 删除指定测试用户及其关联数据
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const DELETE_IDS = [
  'ecbc875b69eb6ea40073a03168cf1ecd',  // test001
  '41d75f4069eb71f300708c8c2ef1b170',  // 2024001
  'c946dc2a69eb73960072ae10713add69',  // 123456
  '99fa253a69eb768b0072494b4a944302',  // 1111
  '99fa253a69eb77200072558a24e27867',  // 111111
  '037e75a269eb77310074800b709de7a8',  // 222
];

const STUDENT_IDS = ['test001', '2024001', '123456', '1111', '111111', '222'];

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
  const _ = db.command;

  // 删除 users
  for (const id of DELETE_IDS) {
    await db.collection('users').doc(id).remove();
    console.log(`已删除 user: ${id}`);
  }

  // 删除 token_counters
  const { data: counters } = await db.collection('token_counters')
    .where({ studentId: _.in(STUDENT_IDS) })
    .get();
  for (const c of counters) {
    await db.collection('token_counters').doc(c._id).remove();
    console.log(`已删除 token_counter: ${c.studentId}`);
  }

  // 删除 usage_records
  const { data: records } = await db.collection('usage_records')
    .where({ studentId: _.in(STUDENT_IDS) })
    .limit(1000)
    .get();
  for (const r of records) {
    await db.collection('usage_records').doc(r._id).remove();
  }
  console.log(`已删除 ${records.length} 条 usage_records`);

  console.log('\n--- 完成 ---');
}

main().catch(console.error);
