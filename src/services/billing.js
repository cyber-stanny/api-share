const { isDeepSeekUpstream, isMiniMaxUpstream, isMimoUpstream } = require('./upstreamLimiter');
const { getDeepSeekPricing, getMimoTokenMultiplier, getMiniMaxRequestUnits } = require('./modelCatalog');

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
  if (isMiniMaxUpstream(upstream)) return 'minimax';
  if (isDeepSeekUpstream(upstream)) return 'deepseek';
  if (isMimoUpstream(upstream)) return 'mimo';
  return 'mimo';
}

function createBillingContext(upstream, model) {
  const billingProvider = getBillingProvider(upstream);

  if (billingProvider === 'minimax') {
    return {
      billingProvider,
      billingType: 'requests',
      billingUnits: getMiniMaxRequestUnits(model) || 1,
      billingCostMicroCny: 0,
      billingCostCny: 0,
    };
  }

  return {
    billingProvider,
    billingType: 'tokens',
    billingUnits: 0,
    billingCostMicroCny: 0,
    billingCostCny: 0,
  };
}

function getTokenBillingUnits(model, usage, billingProvider) {
  const totalTokens = toNumber(usage?.total_tokens);
  if (!totalTokens) return 0;

  const multiplier = billingProvider === 'mimo'
    ? getMimoTokenMultiplier(model)
    : 1;

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

function finalizeBilling(context, model, usage) {
  if (!context || context.billingType !== 'tokens') {
    return context || {
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
  createBillingContext,
  finalizeBilling,
  getBillingProvider,
  getCachedPromptTokens,
  getPromptCacheMissTokens,
  getTokenBillingUnits,
};
