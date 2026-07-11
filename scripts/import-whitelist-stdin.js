/**
 * 从标准输入读取 JSON 白名单并导入 CloudBase。
 * 输入格式：[{ "studentId": "...", "name": "...", "tag": "..." }]
 *
 * 默认只预览：... | node scripts/import-whitelist-stdin.js
 * 确认写入：  ... | node scripts/import-whitelist-stdin.js --apply
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const shouldApply = process.argv.includes('--apply');

async function readStdin() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return JSON.parse(input);
}

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) throw new Error('请设置 CLOUDBASE_ENV_ID 环境变量');

  const rawItems = await readStdin();
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('标准输入必须是非空 JSON 数组');
  }

  const items = rawItems.map(item => ({
    studentId: String(item.studentId || '').trim(),
    name: String(item.name || '').trim(),
    tag: String(item.tag || '').trim(),
  }));
  const invalid = items.filter(item => !item.studentId || item.studentId.length > 64 || item.name.length > 64 || item.tag.length > 64);
  const duplicateIds = items.map(item => item.studentId).filter((id, index, all) => all.indexOf(id) !== index);
  if (invalid.length || duplicateIds.length) {
    throw new Error(`输入校验失败：无效记录 ${invalid.length} 条，重复学号 ${new Set(duplicateIds).size} 个`);
  }

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();
  const pending = [];
  const existing = [];

  for (const item of items) {
    const { data } = await db.collection('whitelist').where({ studentId: item.studentId }).limit(1).get();
    if (data && data.length) existing.push(item.studentId);
    else pending.push(item);
  }

  console.log(`输入 ${items.length} 条，待新增 ${pending.length} 条，已存在 ${existing.length} 条。`);
  if (!shouldApply) {
    console.log('当前为预览模式；确认后添加 --apply 执行。');
    return;
  }

  for (const item of pending) {
    const doc = { studentId: item.studentId, addedAt: new Date() };
    if (item.name) doc.name = item.name;
    if (item.tag) doc.tag = item.tag;
    await db.collection('whitelist').add(doc);
  }
  console.log(`导入完成：新增 ${pending.length} 条，跳过 ${existing.length} 条。`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
