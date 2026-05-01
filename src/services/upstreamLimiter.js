const config = require('../config');

const WINDOW_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const states = new Map();

function isMimoUpstream(upstream) {
  const name = String(upstream?.name || '').toLowerCase();
  const baseUrl = String(upstream?.baseUrl || '').toLowerCase();
  return name.includes('mimo') || baseUrl.includes('xiaomimimo.com');
}

function isMiniMaxUpstream(upstream) {
  const name = String(upstream?.name || '').toLowerCase();
  const baseUrl = String(upstream?.baseUrl || '').toLowerCase();
  return name.includes('minimax') || baseUrl.includes('minimaxi.com');
}

function isDeepSeekUpstream(upstream) {
  const name = String(upstream?.name || '').toLowerCase();
  const baseUrl = String(upstream?.baseUrl || '').toLowerCase();
  return name.includes('deepseek') || baseUrl.includes('deepseek.com');
}

function getLimitProfile(upstream) {
  if (isMimoUpstream(upstream)) {
    return { key: 'mimo', ...config.upstreamLimits.mimo };
  }
  if (isMiniMaxUpstream(upstream)) {
    return { key: 'minimax', ...config.upstreamLimits.minimax };
  }
  if (isDeepSeekUpstream(upstream)) {
    return { key: 'deepseek', ...config.upstreamLimits.deepseek };
  }
  return null;
}

function getState(key) {
  if (!states.has(key)) {
    states.set(key, {
      active: 0,
      queue: [],
      starts: [],
      retryTimer: null,
      lastDailyLogDate: getLocalDateKey(),
      metrics: createMetrics(),
    });
  }
  return states.get(key);
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createMetrics() {
  return {
    date: getLocalDateKey(),
    requestsStarted: 0,
    requestsQueued: 0,
    queueFullRejected: 0,
    queueTimeoutRejected: 0,
    maxConcurrent: 0,
    maxQueueDepth: 0,
    totalQueueWaitMs: 0,
    queuedStarted: 0,
  };
}

function snapshotMetrics(state) {
  const metrics = state.metrics;
  return {
    ...metrics,
    active: state.active,
    queueDepth: state.queue.length,
    rpmWindowCount: state.starts.length,
    avgQueueWaitMs: metrics.queuedStarted > 0
      ? Math.round(metrics.totalQueueWaitMs / metrics.queuedStarted)
      : 0,
  };
}

function logDailyMetrics(key, state, reason = 'daily') {
  console.log('UPSTREAM_LIMITER_DAILY', JSON.stringify({
    upstream: key,
    reason,
    ...snapshotMetrics(state),
  }));
}

function rotateDailyMetricsIfNeeded(key, state) {
  const today = getLocalDateKey();
  if (state.metrics.date === today) return;
  logDailyMetrics(key, state, 'date-rollover');
  state.metrics = createMetrics();
  state.lastDailyLogDate = today;
}

function recordStart(state, queuedAt) {
  const now = Date.now();
  state.active++;
  state.starts.push(now);
  state.metrics.requestsStarted++;
  state.metrics.maxConcurrent = Math.max(state.metrics.maxConcurrent, state.active);
  if (queuedAt) {
    state.metrics.queuedStarted++;
    state.metrics.totalQueueWaitMs += now - queuedAt;
  }
}

function pruneStarts(state, now) {
  while (state.starts.length > 0 && now - state.starts[0] >= WINDOW_MS) {
    state.starts.shift();
  }
}

function scheduleRetry(state, profile) {
  if (state.retryTimer || state.queue.length === 0 || state.starts.length === 0) return;
  const now = Date.now();
  const delay = Math.max(1, WINDOW_MS - (now - state.starts[0]) + 1);
  state.retryTimer = setTimeout(() => {
    state.retryTimer = null;
    drainQueue(state, profile);
  }, delay);
}

function removeQueuedItem(state, item) {
  const index = state.queue.indexOf(item);
  if (index >= 0) {
    state.queue.splice(index, 1);
  }
}

function startItem(state, profile, item) {
  clearTimeout(item.timeout);
  recordStart(state, item.queuedAt);
  item.resolve({
    allowed: true,
    release: () => {
      if (item.released) return;
      item.released = true;
      state.active = Math.max(0, state.active - 1);
      drainQueue(state, profile);
    },
  });
}

function drainQueue(state, profile) {
  const now = Date.now();
  pruneStarts(state, now);

  while (
    state.queue.length > 0 &&
    state.active < profile.maxConcurrent &&
    state.starts.length < profile.rpm
  ) {
    const item = state.queue.shift();
    startItem(state, profile, item);
  }

  if (state.queue.length > 0 && state.starts.length >= profile.rpm) {
    scheduleRetry(state, profile);
  }
}

async function acquireUpstreamSlot(upstream) {
  const profile = getLimitProfile(upstream);
  if (!profile) {
    return { allowed: true, release: () => {} };
  }

  const state = getState(profile.key);
  rotateDailyMetricsIfNeeded(profile.key, state);
  pruneStarts(state, Date.now());

  if (state.active < profile.maxConcurrent && state.starts.length < profile.rpm) {
    recordStart(state);
    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        state.active = Math.max(0, state.active - 1);
        drainQueue(state, profile);
      },
    };
  }

  if (state.queue.length >= profile.maxQueue) {
    state.metrics.queueFullRejected++;
    return {
      allowed: false,
      reason: '上游请求队列已满，请稍后再试',
    };
  }

  return new Promise((resolve) => {
    const item = {
      released: false,
      resolve,
      timeout: null,
      queuedAt: Date.now(),
    };

    item.timeout = setTimeout(() => {
      removeQueuedItem(state, item);
      state.metrics.queueTimeoutRejected++;
      resolve({
        allowed: false,
        reason: '上游请求排队超时，请稍后再试',
      });
    }, profile.queueTimeoutMs);

    state.queue.push(item);
    state.metrics.requestsQueued++;
    state.metrics.maxQueueDepth = Math.max(state.metrics.maxQueueDepth, state.queue.length);
    drainQueue(state, profile);
  });
}

function getUpstreamLimiterMetrics() {
  const result = {};
  for (const [key, state] of states.entries()) {
    rotateDailyMetricsIfNeeded(key, state);
    pruneStarts(state, Date.now());
    result[key] = snapshotMetrics(state);
  }
  return result;
}

setInterval(() => {
  for (const [key, state] of states.entries()) {
    rotateDailyMetricsIfNeeded(key, state);
    logDailyMetrics(key, state, 'interval');
    state.metrics = createMetrics();
  }
}, DAY_MS).unref?.();

module.exports = {
  acquireUpstreamSlot,
  isMimoUpstream,
  isMiniMaxUpstream,
  isDeepSeekUpstream,
  getUpstreamLimiterMetrics,
};
