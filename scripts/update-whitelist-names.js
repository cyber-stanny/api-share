/**
 * 给已有白名单补充姓名字段
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');

const NAME_MAP = {
  '202401050655': '王思懿',
  '202401050687': '张中宝',
  '202401050731': '贾志富',
  '202503071099': '黄启贺',
  '202401050596': '王锦宇',
  '202301072909': '高廉正',
  '202301070207': '郑子桢',
  '26030101':     '戴鹏',
};

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

  const { data: items } = await db.collection('whitelist').limit(1000).get();

  let updated = 0;
  for (const item of items) {
    const name = NAME_MAP[item.studentId];
    if (name && !item.name) {
      await db.collection('whitelist').doc(item._id).update({ name });
      console.log(`已更新：${item.studentId} → ${name}`);
      updated++;
    }
  }

  console.log(`\n--- 完成，更新 ${updated} 条 ---`);
}

main().catch(console.error);
