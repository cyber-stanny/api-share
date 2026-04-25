/**
 * 批量添加白名单学号
 * 使用方式：node scripts/add-whitelist.js
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const STUDENTS = [
  { name: '王思懿', studentId: '202401050655' },
  { name: '张中宝', studentId: '202401050687' },
  { name: '贾志富', studentId: '202401050731' },
  { name: '黄启贺', studentId: '202503071099' },
  { name: '王锦宇', studentId: '202401050596' },
  { name: '高廉正', studentId: '202301072909' },
  { name: '郑子桢', studentId: '202301070207' },
  { name: '戴鹏',   studentId: '26030101' },
];

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

  const added = [];
  const skipped = [];

  for (const { name, studentId } of STUDENTS) {
    const { data: existing } = await db.collection('whitelist')
      .where({ studentId })
      .limit(1)
      .get();

    if (existing && existing.length > 0) {
      skipped.push(`${name} (${studentId})`);
      console.log(`跳过（已存在）：${name} ${studentId}`);
    } else {
      await db.collection('whitelist').add({
        studentId,
        addedAt: new Date(),
      });
      added.push(`${name} (${studentId})`);
      console.log(`已添加：${name} ${studentId}`);
    }
  }

  console.log('\n--- 完成 ---');
  console.log(`新增 ${added.length} 个，跳过 ${skipped.length} 个`);
  if (skipped.length > 0) {
    console.log('已跳过：', skipped.join(', '));
  }
}

main().catch(console.error);
