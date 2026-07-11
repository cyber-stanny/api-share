/**
 * 通过 api-share 自身代理验证 GLM-5.2，并自动清理临时用户与用量数据。
 */
require('dotenv').config();
const { db } = require('../src/db');
const config = require('../src/config');
const { generateApiKey, getApiKeyPrefix, hashApiKey, hashPassword } = require('../src/utils/crypto');
const { getEffectiveTokenQuota } = require('../src/services/quota');

const studentId = `verify-glm-${Date.now()}`;

async function cleanup() {
  for (const collection of ['usage_records', 'usage_daily_stats', 'token_counters', 'users']) {
    await db.collection(collection).where({ studentId }).remove();
  }
}

async function main() {
  const apiKey = generateApiKey();
  await db.collection('users').add({
    studentId,
    name: 'GLM 验证账号',
    passwordHash: await hashPassword(generateApiKey()),
    apiKeyHash: hashApiKey(apiKey),
    apiKeyPrefix: getApiKeyPrefix(apiKey),
    quota: getEffectiveTokenQuota(config.defaultQuota),
    createdAt: new Date(),
  });

  try {
    const response = await fetch('http://127.0.0.1:3000/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: [{ role: 'user', content: '仅回复 OK' }],
        max_tokens: 16,
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.choices?.length || body.model !== 'glm-5.2') {
      throw new Error(`代理验证失败：HTTP ${response.status} ${JSON.stringify(body)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    const { data: records } = await db.collection('usage_records').where({ studentId }).limit(1).get();
    const record = records?.[0];
    if (!record || record.billingProvider !== 'glm' || !(record.billingCostMicroCny > 0)) {
      throw new Error('代理响应成功，但 GLM 计费记录未正确写入');
    }

    console.log(JSON.stringify({
      ok: true,
      model: body.model,
      status: response.status,
      usage: body.usage,
      billingProvider: record.billingProvider,
      billingCostCny: record.billingCostMicroCny / 1000000,
    }));
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
