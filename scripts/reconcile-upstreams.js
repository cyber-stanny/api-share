/**
 * Reconcile provider records after a provider catalogue change.
 *
 * Default mode only prints intended changes. Use --apply only against the
 * intended CloudBase environment after local validation and deployment review.
 */
require('dotenv').config();
const cloudbase = require('@cloudbase/node-sdk');
const { UPSTREAM_PRESETS } = require('../src/services/modelCatalog');

const APPLY = process.argv.includes('--apply');
const RETIRED_PROVIDERS = new Set([
  'MiniMax Token Plan',
  'DeepSeek Token Plan',
  'MiMo Token Plan',
  'Aliyun Token Plan',
]);

function upstreamKey(name, protocol) {
  return `${name}::${protocol || 'openai'}`;
}

function isRetired(upstream) {
  return RETIRED_PROVIDERS.has(upstream.provider)
    || /^(MiniMax|DeepSeek) \(/.test(String(upstream.name || ''));
}

function changedFields(existing, next) {
  return Object.entries(next)
    .filter(([key, value]) => JSON.stringify(existing[key]) !== JSON.stringify(value))
    .map(([key]) => key);
}

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
  const { data: existing } = await db.collection('upstreams').get();
  const byKey = new Map(existing.map(item => [upstreamKey(item.name, item.protocol), item]));
  const presetKeys = new Set(UPSTREAM_PRESETS.map(item => upstreamKey(item.name, item.protocol)));
  let changes = 0;

  for (const preset of UPSTREAM_PRESETS) {
    const current = byKey.get(upstreamKey(preset.name, preset.protocol));
    const apiKey = process.env[preset.apiKeyEnv];
    const desired = {
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      models: preset.models,
      protocol: preset.protocol,
      enabled: preset.enabled,
      priority: preset.priority,
    };
    if (apiKey) desired.apiKey = apiKey;

    if (!current) {
      changes++;
      console.log(`[${APPLY ? 'ADD' : 'WOULD ADD'}] ${preset.name} (${preset.protocol})`);
      if (APPLY) {
        if (!apiKey) {
          throw new Error(`缺少 ${preset.apiKeyEnv}，无法创建 ${preset.name}`);
        }
        await db.collection('upstreams').add({
          name: preset.name,
          ...desired,
          createdAt: new Date(),
        });
      }
      continue;
    }

    const fields = changedFields(current, desired);
    if (fields.length === 0) continue;
    changes++;
    console.log(`[${APPLY ? 'UPDATE' : 'WOULD UPDATE'}] ${preset.name} (${fields.join(', ')})`);
    if (APPLY) {
      await db.collection('upstreams').doc(current._id).update({
        ...desired,
        updatedAt: new Date(),
      });
    }
  }

  for (const upstream of existing.filter(item => isRetired(item) && !presetKeys.has(upstreamKey(item.name, item.protocol)))) {
    if (upstream.enabled === false) continue;
    changes++;
    console.log(`[${APPLY ? 'DISABLE' : 'WOULD DISABLE'}] ${upstream.name}`);
    if (APPLY) {
      await db.collection('upstreams').doc(upstream._id).update({
        enabled: false,
        updatedAt: new Date(),
      });
    }
  }

  if (changes === 0) {
    console.log('上游记录已经与当前模型目录一致。');
  } else if (!APPLY) {
    console.log('\n仅预览，未写入数据库。确认目标环境后运行 npm run reconcile:upstreams:apply。');
  } else {
    console.log(`\n已应用 ${changes} 项上游变更。`);
  }
}

main().catch((err) => {
  console.error('上游对账失败:', err.message || err);
  process.exit(1);
});
