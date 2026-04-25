const cloudbase = require('@cloudbase/node-sdk');
const config = require('./config');

const app = cloudbase.init({
  env: config.envId || cloudbase.SYMBOL_CURRENT_ENV,
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY,
});

const db = app.database();
const _ = db.command;

module.exports = { db, _, app };
