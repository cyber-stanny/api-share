const { isAliyunUpstream, isMimoUpstream } = require('./upstreamLimiter');
const { getMimoTokenMultiplier } = require('./modelCatalog');

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getBillingProvider(upstream) {
  if (isAliyunUpstream(upstream)) return 'aliyun';
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

  const multiplier = billingProvider === 'mimo'
    ? getMimoTokenMultiplier(model)
    : 1;

  return Math.ceil(totalTokens * multiplier);
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

  return {
    ...context,
    billingUnits: getTokenBillingUnits(model, usage, context.billingProvider),
  };
}

module.exports = {
  createBillingContext,
  finalizeBilling,
  getBillingProvider,
  getTokenBillingUnits,
};
