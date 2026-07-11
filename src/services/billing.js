const { isAliyunUpstream, isDeepSeekUpstream, isGlmUpstream, isMimoUpstream } = require('./upstreamLimiter');
const { getDeepSeekPricing, getGlmPricing, getMimoTokenMultiplier } = require('./modelCatalog');

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getCachedPromptTokens(usage) {
  return toNumber(
    usage?.cached_prompt_tokens
    ?? usage?.prompt_cache_hit_tokens
    ?? usage?.prompt_tokens_details?.cached_tokens
    ?? usage?.cache_read_input_tokens
  );
}

function getPromptCacheMissTokens(usage) {
  const explicitMiss = usage?.prompt_cache_miss_tokens ?? usage?.cache_creation_input_tokens;
  if (explicitMiss !== undefined && explicitMiss !== null) {
    return toNumber(explicitMiss);
  }

  return Math.max(0, toNumber(usage?.prompt_tokens) - getCachedPromptTokens(usage));
}

function getBillingProvider(upstream) {
  if (isAliyunUpstream(upstream)) return 'aliyun';
  if (isDeepSeekUpstream(upstream)) return 'deepseek';
  if (isGlmUpstream(upstream)) return 'glm';
  if (isMimoUpstream(upstream)) return 'mimo';
  return 'mimo';
}

function createBillingContext(upstream) {
  return {
    billingProvider: getBillingProvider(upstream),
    billingType: 'tokens',
    billingUnits: 0,
    billingCostMicroCny: 0,
    billingCostCny: 0,
  };
}

function getTokenBillingUnits(model, usage, billingProvider) {
  const totalTokens = toNumber(usage?.total_tokens);
  if (!totalTokens) return 0;

  let multiplier = 1;
  if (billingProvider === 'mimo') {
    multiplier = getMimoTokenMultiplier(model);
  }

  return Math.ceil(totalTokens * multiplier);
}

function calculateDeepSeekCostMicroCny(model, usage) {
  const pricing = getDeepSeekPricing(model);
  if (!pricing || !usage) return 0;

  const cacheHitInputTokens = Math.min(toNumber(usage.prompt_tokens), getCachedPromptTokens(usage));
  const cacheMissInputTokens = getPromptCacheMissTokens(usage);
  const outputTokens = toNumber(usage.completion_tokens);

  return Math.round(
    cacheHitInputTokens * pricing.inputCacheHit
    + cacheMissInputTokens * pricing.inputCacheMiss
    + outputTokens * pricing.output
  );
}

function calculateGlmCostMicroCny(model, usage) {
  const pricing = getGlmPricing(model);
  if (!pricing || !usage) return 0;

  const cacheHitInputTokens = Math.min(toNumber(usage.prompt_tokens), getCachedPromptTokens(usage));
  const cacheMissInputTokens = getPromptCacheMissTokens(usage);
  const outputTokens = toNumber(usage.completion_tokens);

  return Math.round(
    cacheHitInputTokens * pricing.inputCacheHit
    + cacheMissInputTokens * pricing.inputCacheMiss
    + outputTokens * pricing.output
  );
}

function finalizeBilling(context, model, usage) {
  if (!context) {
    return {
      billingProvider: null,
      billingType: 'tokens',
      billingUnits: 0,
      billingCostMicroCny: 0,
      billingCostCny: 0,
    };
  }

  const billingUnits = getTokenBillingUnits(model, usage, context.billingProvider);
  const billingCostMicroCny = context.billingProvider === 'deepseek'
    ? calculateDeepSeekCostMicroCny(model, usage)
    : context.billingProvider === 'glm'
      ? calculateGlmCostMicroCny(model, usage)
      : 0;

  return {
    ...context,
    billingUnits,
    billingCostMicroCny,
    billingCostCny: billingCostMicroCny / 1000000,
  };
}

module.exports = {
  calculateDeepSeekCostMicroCny,
  calculateGlmCostMicroCny,
  createBillingContext,
  finalizeBilling,
  getBillingProvider,
  getCachedPromptTokens,
  getPromptCacheMissTokens,
  getTokenBillingUnits,
};
