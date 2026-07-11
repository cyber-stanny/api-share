const MIMO_MODELS = [
  'mimo-v2.5-pro',
  'mimo-v2.5',
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts',
  'mimo-v2-pro',
  'mimo-v2-omni',
  'mimo-v2-tts',
];

const ALIYUN_MODELS = [
  'qwen3.7-max',
  'glm-5.1',
  'kimi-k2.6',
];

const DEEPSEEK_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
];

const GLM_MODELS = [
  'glm-5.2',
];

const DEEPSEEK_PRICING_PER_MILLION_CNY = {
  'deepseek-v4-flash': {
    inputCacheHit: 0.02,
    inputCacheMiss: 1,
    output: 2,
  },
  'deepseek-v4-pro': {
    inputCacheHit: 0.025,
    inputCacheMiss: 3,
    output: 6,
  },
};

const GLM_PRICING_PER_MILLION_CNY = {
  'glm-5.2': {
    inputCacheHit: 2,
    inputCacheMiss: 8,
    output: 28,
  },
};

const MODEL_METADATA = [
  ...DEEPSEEK_MODELS.map(id => ({ id, provider: 'DeepSeek Official API', protocols: ['openai', 'anthropic'] })),
  ...GLM_MODELS.map(id => ({ id, provider: '智谱 GLM Official API', protocols: ['openai'] })),
];

const NON_TEXT_MODELS = new Set([
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts',
  'mimo-v2-tts',
]);

const PUBLIC_TEXT_MODELS = new Set(
  MODEL_METADATA
    .map(model => model.id)
    .filter(id => !NON_TEXT_MODELS.has(id))
);

function isTextModelSupported(id) {
  return PUBLIC_TEXT_MODELS.has(id);
}

function isUpstreamSupported(upstream) {
  return upstream?.provider === 'DeepSeek Official API' || upstream?.provider === '智谱 GLM Official API';
}

const MIMO_UPSTREAMS = [
  {
    name: 'Mimo (OpenAI)',
    provider: 'MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com',
    apiKeyEnv: 'MIMO_API_KEY',
    models: MIMO_MODELS,
    protocol: 'openai',
    enabled: false,
    priority: 10,
  },
  {
    name: 'Mimo (Anthropic)',
    provider: 'MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    apiKeyEnv: 'MIMO_API_KEY',
    models: MIMO_MODELS,
    protocol: 'anthropic',
    enabled: false,
    priority: 10,
  },
];

const ALIYUN_UPSTREAMS = [
  {
    name: 'Aliyun Token Plan (OpenAI)',
    provider: 'Aliyun Token Plan',
    // The proxy appends /v1/chat/completions, so omit the caller-facing /v1 suffix here.
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode',
    apiKeyEnv: 'ALIYUN_API_KEY',
    models: ALIYUN_MODELS,
    protocol: 'openai',
    enabled: false,
    priority: 20,
  },
  {
    name: 'Aliyun Token Plan (Anthropic)',
    provider: 'Aliyun Token Plan',
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic',
    apiKeyEnv: 'ALIYUN_API_KEY',
    models: ALIYUN_MODELS,
    protocol: 'anthropic',
    enabled: false,
    priority: 20,
  },
];

const DEEPSEEK_UPSTREAMS = [
  {
    name: 'DeepSeek Official (OpenAI)',
    provider: 'DeepSeek Official API',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: DEEPSEEK_MODELS,
    protocol: 'openai',
    enabled: true,
    priority: 30,
  },
  {
    name: 'DeepSeek Official (Anthropic)',
    provider: 'DeepSeek Official API',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: DEEPSEEK_MODELS,
    protocol: 'anthropic',
    enabled: true,
    priority: 30,
  },
];

const GLM_UPSTREAMS = [
  {
    name: '智谱 GLM Official (OpenAI)',
    provider: '智谱 GLM Official API',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiPath: '/chat/completions',
    apiKeyEnv: 'GLM_API_KEY',
    models: GLM_MODELS,
    protocol: 'openai',
    enabled: true,
    priority: 30,
  },
];

const UPSTREAM_PRESETS = [...MIMO_UPSTREAMS, ...ALIYUN_UPSTREAMS, ...DEEPSEEK_UPSTREAMS, ...GLM_UPSTREAMS];

const MODEL_ORDER = MODEL_METADATA.map(model => model.id);

function getModelMetadata(id) {
  return MODEL_METADATA.find(model => model.id === id) || {
    id,
    provider: 'API Share',
    protocols: ['openai'],
  };
}

function getMimoTokenMultiplier(modelId) {
  return modelId === 'mimo-v2.5' ? 2 : 1;
}

function getDeepSeekPricing(modelId) {
  return DEEPSEEK_PRICING_PER_MILLION_CNY[modelId] || null;
}

function getGlmPricing(modelId) {
  return GLM_PRICING_PER_MILLION_CNY[modelId] || null;
}

module.exports = {
  MIMO_MODELS,
  ALIYUN_MODELS,
  DEEPSEEK_MODELS,
  GLM_MODELS,
  DEEPSEEK_PRICING_PER_MILLION_CNY,
  GLM_PRICING_PER_MILLION_CNY,
  MODEL_METADATA,
  MODEL_ORDER,
  MIMO_UPSTREAMS,
  ALIYUN_UPSTREAMS,
  DEEPSEEK_UPSTREAMS,
  GLM_UPSTREAMS,
  UPSTREAM_PRESETS,
  getDeepSeekPricing,
  getGlmPricing,
  getModelMetadata,
  getMimoTokenMultiplier,
  isTextModelSupported,
  isUpstreamSupported,
};
