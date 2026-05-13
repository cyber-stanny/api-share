const express = require('express');
const jwt = require('jsonwebtoken');
const { db, _ } = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, generateApiKey, hashApiKey, getApiKeyPrefix } = require('../utils/crypto');
const { adminAuth } = require('../middleware/adminAuth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const { getUpstreamLimiterMetrics } = require('../services/upstreamLimiter');
const { getUsageSummary, getOrCreateCounter } = require('../services/quota');
const { queryUsageStats } = require('../services/usageStats');
const { parseBeijingDateParam } = require('../utils/dateParams');
const router = express.Router();

const adminLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `admin-login:${req.ip}`,
});

function parsePageParams(query, defaultPageSize = 20) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? defaultPageSize : Number(query.pageSize);

  if (!Number.isInteger(page) || page < 1) {
    return { error: 'page 必须是大于等于 1 的整数' };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { error: 'pageSize 必须是 1-100 之间的整数' };
  }
  return { page, pageSize };
}

function parseTokenLimit(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: `${fieldName} 必须是非负整数` };
  }
  return { value: parsed };
}

function parseDateParam(value, fieldName) {
  return parseBeijingDateParam(value, fieldName);
}

function validateUsageFilters({ studentId, model, provider, groupBy }) {
  if (studentId && String(studentId).length > 64) {
    return 'studentId 不能超过 64 个字符';
  }
  if (model && String(model).length > 128) {
    return 'model 不能超过 128 个字符';
  }
  if (provider && !['mimo', 'minimax', 'deepseek'].includes(provider)) {
    return 'provider 只支持 mimo / minimax / deepseek';
  }
  if (groupBy && !['day', 'week', 'month', 'all'].includes(groupBy)) {
    return 'groupBy 只支持 day / week / month / all';
  }
  return null;
}

function isValidShortText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

// 管理员登录
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空');
    }

    const { data } = await db.collection('admins')
      .where({ username })
      .limit(1)
      .get();

    if (!data || data.length === 0) {
      return error(res, '用户名或密码错误');
    }

    const admin = data[0];
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return error(res, '用户名或密码错误');
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return success(res, { token, username: admin.username });
  } catch (err) {
    console.error('Admin login error:', err);
    return error(res, '登录失败', 500);
  }
});

// 学生列表 + 用量
router.get('/students', adminAuth, async (req, res) => {
  try {
    const pageParams = parsePageParams(req.query, 20);
    if (pageParams.error) return error(res, pageParams.error);
    const { page, pageSize } = pageParams;

    const { data: students, total } = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    // 批量查 token 用量，读取前先按北京时间校准日/周计数。
    const studentsWithUsage = await Promise.all(students.map(async (s) => {
      const counter = await getOrCreateCounter(s.studentId);
      const usage = getUsageSummary(counter || {});

      return {
        _id: s._id,
        studentId: s.studentId,
        name: s.name,
        apiKeyPrefix: s.apiKeyPrefix,
        quota: s.quota,
        ...usage,
        deepseekQuota: {
          dailyCostLimitCny: Number.isFinite(Number(s.quota?.deepseekDailyCostLimitCny))
            ? Number(s.quota.deepseekDailyCostLimitCny)
            : config.defaultDeepSeekQuota.dailyCostLimitCny,
          weeklyCostLimitCny: Number.isFinite(Number(s.quota?.deepseekWeeklyCostLimitCny))
            ? Number(s.quota.deepseekWeeklyCostLimitCny)
            : config.defaultDeepSeekQuota.weeklyCostLimitCny,
        },
        minimaxQuota: {
          dailyRequestLimit: Number.isFinite(Number(s.quota?.minimaxDailyRequestLimit))
            ? Number(s.quota.minimaxDailyRequestLimit)
            : config.defaultMiniMaxQuota.dailyRequestLimit,
          weeklyRequestLimit: Number.isFinite(Number(s.quota?.minimaxWeeklyRequestLimit))
            ? Number(s.quota.minimaxWeeklyRequestLimit)
            : config.defaultMiniMaxQuota.weeklyRequestLimit,
        },
        createdAt: s.createdAt,
      };
    }));

    return success(res, { students: studentsWithUsage, total, page, pageSize });
  } catch (err) {
    console.error('List students error:', err);
    return error(res, '查询失败', 500);
  }
});

// 调整学生额度
router.put('/students/:id/quota', adminAuth, async (req, res) => {
  try {
    const { dailyTokenLimit, weeklyTokenLimit, deepseekDailyCostLimitCny, deepseekWeeklyCostLimitCny, minimaxDailyRequestLimit, minimaxWeeklyRequestLimit } = req.body;
    const update = {};
    let nextDailyLimit;
    let nextWeeklyLimit;

    if (dailyTokenLimit !== undefined) {
      const parsed = parseTokenLimit(dailyTokenLimit, 'dailyTokenLimit');
      if (parsed.error) return error(res, parsed.error);
      nextDailyLimit = parsed.value;
      update['quota.dailyTokenLimit'] = nextDailyLimit;
    }
    if (weeklyTokenLimit !== undefined) {
      const parsed = parseTokenLimit(weeklyTokenLimit, 'weeklyTokenLimit');
      if (parsed.error) return error(res, parsed.error);
      nextWeeklyLimit = parsed.value;
      update['quota.weeklyTokenLimit'] = nextWeeklyLimit;
    }
    if (deepseekDailyCostLimitCny !== undefined) {
      const val = Number(deepseekDailyCostLimitCny);
      if (!Number.isFinite(val) || val < 0) return error(res, 'deepseekDailyCostLimitCny 必须是非负数');
      update['quota.deepseekDailyCostLimitCny'] = val;
    }
    if (deepseekWeeklyCostLimitCny !== undefined) {
      const val = Number(deepseekWeeklyCostLimitCny);
      if (!Number.isFinite(val) || val < 0) return error(res, 'deepseekWeeklyCostLimitCny 必须是非负数');
      update['quota.deepseekWeeklyCostLimitCny'] = val;
    }
    if (minimaxDailyRequestLimit !== undefined) {
      const parsed = parseTokenLimit(minimaxDailyRequestLimit, 'minimaxDailyRequestLimit');
      if (parsed.error) return error(res, parsed.error);
      update['quota.minimaxDailyRequestLimit'] = parsed.value;
    }
    if (minimaxWeeklyRequestLimit !== undefined) {
      const parsed = parseTokenLimit(minimaxWeeklyRequestLimit, 'minimaxWeeklyRequestLimit');
      if (parsed.error) return error(res, parsed.error);
      update['quota.minimaxWeeklyRequestLimit'] = parsed.value;
    }

    if (Object.keys(update).length === 0) {
      return error(res, '请提供要调整的额度');
    }

    const { data: users } = await db.collection('users').doc(req.params.id).get();
    const currentUser = Array.isArray(users) ? users[0] : users;
    if (!currentUser) {
      return error(res, '用户不存在', 404);
    }
    const currentQuota = currentUser.quota || config.defaultQuota;
    const effectiveDailyLimit = nextDailyLimit !== undefined ? nextDailyLimit : currentQuota.dailyTokenLimit;
    const effectiveWeeklyLimit = nextWeeklyLimit !== undefined ? nextWeeklyLimit : currentQuota.weeklyTokenLimit;

    if (effectiveWeeklyLimit < effectiveDailyLimit) {
      return error(res, 'weeklyTokenLimit 不能小于 dailyTokenLimit');
    }

    await db.collection('users').doc(req.params.id).update(update);
    return success(res, { message: '额度已更新' });
  } catch (err) {
    console.error('Update quota error:', err);
    return error(res, '更新失败', 500);
  }
});

// 管理员重置学生密码
router.put('/students/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return error(res, '新密码至少 6 位');
    }

    const { data: users } = await db.collection('users').doc(req.params.id).get();
    const user = Array.isArray(users) ? users[0] : users;
    if (!user) {
      return error(res, '学生不存在', 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await db.collection('users').doc(req.params.id).update({ passwordHash });

    return success(res, { message: '密码已重置' });
  } catch (err) {
    console.error('Admin reset password error:', err);
    return error(res, '重置失败', 500);
  }
});

// 添加学生（管理员直接添加，不需要白名单）
router.post('/students', adminAuth, async (req, res) => {
  try {
    const { studentId, password, name, dailyTokenLimit, weeklyTokenLimit } = req.body;

    if (!isValidShortText(studentId, 64) || !isValidShortText(password, 128)) {
      return error(res, '学号和密码不能为空');
    }
    if (name !== undefined && String(name).length > 64) {
      return error(res, '姓名不能超过 64 个字符');
    }

    const dailyParsed = dailyTokenLimit === undefined
      ? { value: config.defaultQuota.dailyTokenLimit }
      : parseTokenLimit(dailyTokenLimit, 'dailyTokenLimit');
    if (dailyParsed.error) return error(res, dailyParsed.error);

    const weeklyParsed = weeklyTokenLimit === undefined
      ? { value: config.defaultQuota.weeklyTokenLimit }
      : parseTokenLimit(weeklyTokenLimit, 'weeklyTokenLimit');
    if (weeklyParsed.error) return error(res, weeklyParsed.error);

    if (weeklyParsed.value < dailyParsed.value) {
      return error(res, 'weeklyTokenLimit 不能小于 dailyTokenLimit');
    }

    // 检查是否已存在
    const { data: existing } = await db.collection('users')
      .where({ studentId })
      .limit(1)
      .get();

    if (existing && existing.length > 0) {
      return error(res, '该学号已存在');
    }

    const passwordHash = await hashPassword(password);
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    const result = await db.collection('users').add({
      studentId,
      name: name || '',
      passwordHash,
      apiKeyHash,
      apiKeyPrefix,
      quota: {
        dailyTokenLimit: dailyParsed.value,
        weeklyTokenLimit: weeklyParsed.value,
      },
      createdAt: new Date(),
    });

    return success(res, {
      id: result.id,
      studentId,
      apiKey,
      message: '学生已添加',
    }, 201);
  } catch (err) {
    console.error('Add student error:', err);
    return error(res, '添加失败', 500);
  }
});

// 白名单列表
router.get('/whitelist', adminAuth, async (req, res) => {
  try {
    const { data, total } = await db.collection('whitelist')
      .orderBy('addedAt', 'desc')
      .limit(1000)
      .get();

    return success(res, { items: data, total });
  } catch (err) {
    return error(res, '查询失败', 500);
  }
});

// 添加白名单
router.post('/whitelist', adminAuth, async (req, res) => {
  try {
    const { items } = req.body; // [{ studentId, name? }]

    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 200) {
      return error(res, '请提供学号列表，格式: items: [{ studentId, name? }]');
    }

    const normalizedItems = items.map(item => {
      const sid = String(item.studentId || '').trim();
      const name = item.name !== undefined ? String(item.name).trim() : '';
      return { studentId: sid, name };
    }).filter(item => item.studentId.length > 0 && item.studentId.length <= 64);

    if (normalizedItems.length === 0) {
      return error(res, '学号格式不合法');
    }

    const added = [];
    const skipped = [];

    for (const { studentId, name } of normalizedItems) {
      const { data: existing } = await db.collection('whitelist')
        .where({ studentId })
        .limit(1)
        .get();

      if (existing && existing.length > 0) {
        skipped.push(studentId);
      } else {
        const doc = { studentId, addedAt: new Date() };
        if (name) doc.name = name;
        await db.collection('whitelist').add(doc);
        added.push(studentId);
      }
    }

    return success(res, { added, skipped, message: `添加 ${added.length} 个，跳过 ${skipped.length} 个` });
  } catch (err) {
    console.error('Add whitelist error:', err);
    return error(res, '添加失败', 500);
  }
});

// 删除白名单
router.delete('/whitelist/:id', adminAuth, async (req, res) => {
  try {
    await db.collection('whitelist').doc(req.params.id).remove();
    return success(res, { message: '已删除' });
  } catch (err) {
    return error(res, '删除失败', 500);
  }
});

// 用量统计
router.get('/usage', adminAuth, async (req, res) => {
  try {
    const { studentId, startDate, endDate, model, provider } = req.query;
    const pageParams = parsePageParams(req.query, 50);
    if (pageParams.error) return error(res, pageParams.error);
    const { page, pageSize } = pageParams;

    const start = parseDateParam(startDate, 'startDate');
    if (start.error) return error(res, start.error);
    const end = parseDateParam(endDate, 'endDate');
    if (end.error) return error(res, end.error);
    if (start.value && end.value && start.value > end.value) {
      return error(res, 'startDate 不能晚于 endDate');
    }
    const filterError = validateUsageFilters({ studentId, model, provider });
    if (filterError) return error(res, filterError);

    const conditions = [];
    if (studentId) conditions.push({ studentId });
    if (model) conditions.push({ model });
    if (provider) conditions.push({ billingProvider: provider });
    if (start.value) conditions.push({ createdAt: _.gte(start.value) });
    if (end.value) conditions.push({ createdAt: _.lte(end.value) });

    const where = conditions.length > 0 ? _.and(...conditions) : {};

    const { data: records, total } = await db.collection('usage_records')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return success(res, { records, total, page, pageSize });
  } catch (err) {
    console.error('Usage query error:', err);
    return error(res, '查询失败', 500);
  }
});

// 历史用量统计（按日汇总，可聚合为周/月/累计）
router.get('/usage/stats', adminAuth, async (req, res) => {
  try {
    const { studentId, startDate, endDate, model, provider, groupBy = 'day' } = req.query;
    const filterError = validateUsageFilters({ studentId, model, provider, groupBy });
    if (filterError) return error(res, filterError);

    const start = parseDateParam(startDate, 'startDate');
    if (start.error) return error(res, start.error);
    const end = parseDateParam(endDate, 'endDate');
    if (end.error) return error(res, end.error);
    if (start.value && end.value && start.value > end.value) {
      return error(res, 'startDate 不能晚于 endDate');
    }

    const stats = await queryUsageStats({
      studentId,
      provider,
      model,
      startDate: start.value,
      endDate: end.value,
      groupBy,
    });

    return success(res, stats);
  } catch (err) {
    console.error('Usage stats query error:', err);
    return error(res, '查询失败', 500);
  }
});

// 上游限流运行指标（内存级，按当前实例统计）
router.get('/upstream-metrics', adminAuth, async (req, res) => {
  return success(res, {
    metrics: getUpstreamLimiterMetrics(),
    note: '该指标为当前 Node/云函数实例内存统计，多实例部署时需要汇总各实例日志。',
  });
});

module.exports = router;
