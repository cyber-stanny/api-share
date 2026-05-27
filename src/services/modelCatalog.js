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
  'deepseek-v4-flash',
  'deepseek-v4-pro',
];

const MODEL_METADATA = [
  { id: 'mimo-v2.5-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5-tts-voiceclone', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2.5-tts-voicedesign', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2.5-tts', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-omni', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  ...ALIYUN_MODELS.map(id => ({ id, provider: 'Aliyun Token Plan', protocols: ['openai', 'anthropic'] })),
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
  return upstream?.provider === 'MiMo Token Plan' || upstream?.provider === 'Aliyun Token Plan';
}

const MIMO_UPSTREAMS = [
  {
    name: 'Mimo (OpenAI)',
    provider: 'MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com',
    apiKeyEnv: 'MIMO_API_KEY',
    models: MIMO_MODELS,
    protocol: 'openai',
    enabled: true,
    priority: 10,
  },
  {
    name: 'Mimo (Anthropic)',
    provider: 'MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    apiKeyEnv: 'MIMO_API_KEY',
    models: MIMO_MODELS,
    protocol: 'anthropic',
    enabled: true,
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
    enabled: true,
    priority: 20,
  },
  {
    name: 'Aliyun Token Plan (Anthropic)',
    provider: 'Aliyun Token Plan',
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic',
    apiKeyEnv: 'ALIYUN_API_KEY',
    models: ALIYUN_MODELS,
    protocol: 'anthropic',
    enabled: true,
    priority: 20,
  },
];

const UPSTREAM_PRESETS = [...MIMO_UPSTREAMS, ...ALIYUN_UPSTREAMS];

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

module.exports = {
  MIMO_MODELS,
  ALIYUN_MODELS,
  MODEL_METADATA,
  MODEL_ORDER,
  MIMO_UPSTREAMS,
  ALIYUN_UPSTREAMS,
  UPSTREAM_PRESETS,
  getModelMetadata,
  getMimoTokenMultiplier,
  isTextModelSupported,
  isUpstreamSupported,
};
