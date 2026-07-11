/**
 * 给所有尚未设置标签的白名单记录补充默认标签。
 *
 * 默认只预览：node scripts/tag-existing-whitelist.js
 * 确认写入：  node scripts/tag-existing-whitelist.js --apply
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const DEFAULT_TAG = process.env.WHITELIST_DEFAULT_TAG || '山东外国语职业技术大学';
const shouldApply = process.argv.includes('--apply');

async function main() {
  const envId = process.env.CLOUDBASE_ENV_ID;
  if (!envId) throw new Error('请设置 CLOUDBASE_ENV_ID 环境变量');

  const app = cloudbase.init({
    env: envId,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  });
  const db = app.database();
  const { data: items } = await db.collection('whitelist').limit(1000).get();
  const pending = items.filter(item => !String(item.tag || '').trim());

  console.log(`白名单共 ${items.length} 条，待标记 ${pending.length} 条，标签：${DEFAULT_TAG}`);
  if (!shouldApply) {
    console.log('当前为预览模式；确认后添加 --apply 执行。');
    return;
  }

  for (const item of pending) {
    await db.collection('whitelist').doc(item._id).update({ tag: DEFAULT_TAG });
  }
  console.log(`已完成：更新 ${pending.length} 条。`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
