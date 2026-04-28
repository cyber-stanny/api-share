const express = require('express');
const jwt = require('jsonwebtoken');
const { db, _ } = require('../db');
const config = require('../config');
const { hashPassword, verifyPassword, generateApiKey, hashApiKey, getApiKeyPrefix } = require('../utils/crypto');
const { adminAuth } = require('../middleware/adminAuth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const { getUpstreamLimiterMetrics } = require('../services/upstreamLimiter');
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
  if (!value) return { value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `${fieldName} 必须是有效日期` };
  }
  return { value: date };
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

    // 批量查 token 用量
    const studentsWithUsage = await Promise.all(students.map(async (s) => {
      const { data: counters } = await db.collection('token_counters')
        .where({ studentId: s.studentId })
        .limit(1)
        .get();

      const counter = counters && counters.length > 0 ? counters[0] : null;

      return {
        _id: s._id,
        studentId: s.studentId,
        name: s.name,
        apiKeyPrefix: s.apiKeyPrefix,
        quota: s.quota,
        dailyTokensUsed: counter?.dailyTokens || 0,
        weeklyTokensUsed: counter?.weeklyTokens || 0,
        minimaxDailyRequestsUsed: counter?.minimaxDailyRequests || 0,
        minimaxWeeklyRequestsUsed: counter?.minimaxWeeklyRequests || 0,
        createdAt: s.createdAt,
      };
    }));

    return success(res, { students: studentsWithUsage, total, page, pageSize });
  } catch (err) {
    console.error('List students error:', err);
    return error(res, '查询失败', 500);
  }
});

// 调整学生额度（按 token）
router.put('/students/:id/quota', adminAuth, async (req, res) => {
  try {
    const { dailyTokenLimit, weeklyTokenLimit } = req.body;
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
    const { studentId, startDate, endDate, model } = req.query;
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
    if (studentId && String(studentId).length > 64) {
      return error(res, 'studentId 不能超过 64 个字符');
    }
    if (model && String(model).length > 128) {
      return error(res, 'model 不能超过 128 个字符');
    }

    const conditions = [];
    if (studentId) conditions.push({ studentId });
    if (model) conditions.push({ model });
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

// 上游限流运行指标（内存级，按当前实例统计）
router.get('/upstream-metrics', adminAuth, async (req, res) => {
  return success(res, {
    metrics: getUpstreamLimiterMetrics(),
    note: '该指标为当前 Node/云函数实例内存统计，多实例部署时需要汇总各实例日志。',
  });
});

module.exports = router;
