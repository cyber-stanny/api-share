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

const MINIMAX_MODELS = [
  'MiniMax-M2.7',
  'MiniMax-M2.7-highspeed',
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed',
  'MiniMax-M2.1',
  'MiniMax-M2.1-highspeed',
  'MiniMax-M2',
];

const DEEPSEEK_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
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

const MODEL_METADATA = [
  { id: 'MiniMax-M2.7', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.7-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.5', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.5-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.1', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2.1-highspeed', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'MiniMax-M2', provider: 'MiniMax Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2.5-tts-voiceclone', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2.5-tts-voicedesign', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2.5-tts', provider: 'MiMo Token Plan', protocols: ['openai'] },
  { id: 'mimo-v2-pro', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'mimo-v2-omni', provider: 'MiMo Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'deepseek-v4-flash', provider: 'DeepSeek Token Plan', protocols: ['openai', 'anthropic'] },
  { id: 'deepseek-v4-pro', provider: 'DeepSeek Token Plan', protocols: ['openai', 'anthropic'] },
];

const NON_TEXT_MODELS = new Set([
  'mimo-v2.5-tts-voiceclone',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts',
  'mimo-v2-tts',
]);

function isTextModelSupported(id) {
  if (!id) return false;
  return !NON_TEXT_MODELS.has(id);
}

const MINIMAX_UPSTREAMS = [
  {
    name: 'MiniMax (OpenAI)',
    provider: 'MiniMax Token Plan',
    baseUrl: 'https://api.minimaxi.com',
    apiKeyEnv: 'MINIMAX_API_KEY',
    models: MINIMAX_MODELS,
    protocol: 'openai',
    enabled: true,
    priority: 20,
  },
  {
    name: 'MiniMax (Anthropic)',
    provider: 'MiniMax Token Plan',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    apiKeyEnv: 'MINIMAX_API_KEY',
    models: MINIMAX_MODELS,
    protocol: 'anthropic',
    enabled: true,
    priority: 20,
  },
];

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
    baseUrl: 'https://token-plan-cn.xiaomimimo.com',
    apiKeyEnv: 'MIMO_API_KEY',
    models: MIMO_MODELS,
    protocol: 'anthropic',
    enabled: true,
    priority: 10,
  },
];

const DEEPSEEK_UPSTREAMS = [
  {
    name: 'DeepSeek (OpenAI)',
    provider: 'DeepSeek Token Plan',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: DEEPSEEK_MODELS,
    protocol: 'openai',
    enabled: true,
    priority: 15,
  },
  {
    name: 'DeepSeek (Anthropic)',
    provider: 'DeepSeek Token Plan',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: DEEPSEEK_MODELS,
    protocol: 'anthropic',
    enabled: true,
    priority: 15,
  },
];

const UPSTREAM_PRESETS = [...MINIMAX_UPSTREAMS, ...MIMO_UPSTREAMS, ...DEEPSEEK_UPSTREAMS];

const MODEL_ORDER = MODEL_METADATA.map(model => model.id);

function getModelMetadata(id) {
  return MODEL_METADATA.find(model => model.id === id) || {
    id,
    provider: 'API Share',
    protocols: ['openai'],
  };
}

function getMiniMaxRequestUnits(modelId) {
  if (!String(modelId || '').startsWith('MiniMax-')) return 0;
  return 1;
}

function getMimoTokenMultiplier(modelId) {
  return modelId === 'mimo-v2.5' ? 2 : 1;
}

function getDeepSeekPricing(modelId) {
  return DEEPSEEK_PRICING_PER_MILLION_CNY[modelId] || null;
}

module.exports = {
  MIMO_MODELS,
  MINIMAX_MODELS,
  DEEPSEEK_MODELS,
  DEEPSEEK_PRICING_PER_MILLION_CNY,
  MODEL_METADATA,
  MODEL_ORDER,
  MIMO_UPSTREAMS,
  MINIMAX_UPSTREAMS,
  DEEPSEEK_UPSTREAMS,
  UPSTREAM_PRESETS,
  getModelMetadata,
  getMiniMaxRequestUnits,
  getMimoTokenMultiplier,
  getDeepSeekPricing,
  isTextModelSupported,
};
