const express = require('express');
const jwt = require('jsonwebtoken');
const { db, _ } = require('../db');
const config = require('../config');
const { generateApiKey, hashApiKey, getApiKeyPrefix, hashPassword, verifyPassword } = require('../utils/crypto');
const { studentAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const { getAvailableModelDetails } = require('../services/upstream');
const { getUsageSummary, getDeepSeekCostQuota } = require('../services/quota');

const router = express.Router();

const studentLoginIpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => `student-login-ip:${req.ip}`,
});

const studentLoginAccountLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `student-login-account:${req.ip}:${req.body?.studentId || ''}`,
});

const studentRegisterLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `student-register:${req.ip}`,
});

function isValidShortText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

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

function parseDateParam(value, fieldName) {
  if (!value) return { value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `${fieldName} 必须是有效日期` };
  }
  return { value: date };
}

// 学号注册
router.post('/register', studentRegisterLimiter, async (req, res) => {
  try {
    const { studentId, password, name } = req.body;

    if (!isValidShortText(studentId, 64) || !isValidShortText(password, 128)) {
      return error(res, '学号和密码不能为空');
    }

    if (password.length < 6) {
      return error(res, '密码至少 6 位');
    }
    if (name !== undefined && String(name).length > 64) {
      return error(res, '姓名不能超过 64 个字符');
    }

    // 检查白名单
    const { data: whitelist } = await db.collection('whitelist')
      .where({ studentId })
      .limit(1)
      .get();

    if (!whitelist || whitelist.length === 0) {
      return error(res, '学号不在白名单中，请联系管理员');
    }

    // 检查是否已注册
    const { data: existing } = await db.collection('users')
      .where({ studentId })
      .limit(1)
      .get();

    if (existing && existing.length > 0) {
      return error(res, '该学号已注册');
    }

    // 创建用户
    const passwordHash = await hashPassword(password);
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    await db.collection('users').add({
      studentId,
      name: name || '',
      passwordHash,
      apiKeyHash,
      apiKeyPrefix,
      quota: config.defaultQuota,
      createdAt: new Date(),
    });

    return success(res, {
      message: '注册成功',
      apiKey, // 只在注册时返回一次明文
      note: '请妥善保存 API Key，后续无法再次查看',
    }, 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, '注册失败', 500);
  }
});

// 登录
router.post('/login', studentLoginIpLimiter, studentLoginAccountLimiter, async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!isValidShortText(studentId, 64) || !isValidShortText(password, 128)) {
      return error(res, '学号和密码不能为空');
    }

    const { data } = await db.collection('users')
      .where({ studentId })
      .limit(1)
      .get();

    if (!data || data.length === 0) {
      return error(res, '学号或密码错误');
    }

    const user = data[0];
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return error(res, '学号或密码错误');
    }

    const token = jwt.sign(
      { id: user._id, studentId: user.studentId, role: 'student' },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    return success(res, { token, studentId: user.studentId });
  } catch (err) {
    console.error('Login error:', err);
    return error(res, '登录失败', 500);
  }
});

const studentResetLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req) => `student-reset:${req.ip}:${req.body?.studentId || ''}`,
});

// 重置密码（学号 + 姓名验证）
router.post('/reset-password', studentResetLimiter, async (req, res) => {
  try {
    const { studentId, name, newPassword } = req.body;

    if (!isValidShortText(studentId, 64)) {
      return error(res, '学号不能为空');
    }
    if (!isValidShortText(name, 64)) {
      return error(res, '姓名不能为空');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return error(res, '新密码至少 6 位');
    }

    const { data } = await db.collection('users')
      .where({ studentId })
      .limit(1)
      .get();

    if (!data || data.length === 0) {
      return error(res, '学号不存在');
    }

    const user = data[0];
    // 如果学生注册时填写了姓名，则验证姓名匹配
    if (user.name && user.name !== name.trim()) {
      return error(res, '姓名不匹配');
    }

    const passwordHash = await hashPassword(newPassword);
    await db.collection('users').where({ studentId }).update({ passwordHash });

    return success(res, { message: '密码已重置，请使用新密码登录' });
  } catch (err) {
    console.error('Reset password error:', err);
    return error(res, '重置失败', 500);
  }
});

// 查看当前 Key 前缀
router.get('/key', studentAuth, async (req, res) => {
  try {
    const { data } = await db.collection('users')
      .where({ studentId: req.student.studentId })
      .limit(1)
      .get();

    if (!data || data.length === 0) {
      return error(res, '用户不存在', 404);
    }

    return success(res, {
      apiKeyPrefix: data[0].apiKeyPrefix,
      note: '完整 Key 仅在注册时展示一次，如需重新生成请调用 /api/auth/key/regenerate',
    });
  } catch (err) {
    return error(res, '查询失败', 500);
  }
});

// 学生个人信息和额度用量
router.get('/profile', studentAuth, async (req, res) => {
  try {
    const { data: users } = await db.collection('users')
      .where({ studentId: req.student.studentId })
      .limit(1)
      .get();

    if (!users || users.length === 0) {
      return error(res, '用户不存在', 404);
    }

    const user = users[0];
    const { data: counters } = await db.collection('token_counters')
      .where({ studentId: req.student.studentId })
      .limit(1)
      .get();
    const counter = counters && counters.length > 0 ? counters[0] : {};
    const quota = user.quota || config.defaultQuota;
    const userQuota = user.quota || {};
    const defaultMiniMaxQuota = config.defaultMiniMaxQuota;
    const miniMaxQuota = {
      dailyRequestLimit: Number.isFinite(Number(userQuota.minimaxDailyRequestLimit))
        ? Number(userQuota.minimaxDailyRequestLimit)
        : defaultMiniMaxQuota.dailyRequestLimit,
      weeklyRequestLimit: Number.isFinite(Number(userQuota.minimaxWeeklyRequestLimit))
        ? Number(userQuota.minimaxWeeklyRequestLimit)
        : defaultMiniMaxQuota.weeklyRequestLimit,
    };
    const usage = getUsageSummary(counter);

    const defaultDsQuota = getDeepSeekCostQuota();
    const deepseekQuota = {
      dailyCostLimitCny: Number.isFinite(Number(userQuota.deepseekDailyCostLimitCny))
        ? Number(userQuota.deepseekDailyCostLimitCny)
        : defaultDsQuota.dailyCostLimitCny,
      weeklyCostLimitCny: Number.isFinite(Number(userQuota.deepseekWeeklyCostLimitCny))
        ? Number(userQuota.deepseekWeeklyCostLimitCny)
        : defaultDsQuota.weeklyCostLimitCny,
    };

    return success(res, {
      studentId: user.studentId,
      name: user.name || '',
      apiKeyPrefix: user.apiKeyPrefix,
      quota,
      ...usage,
      minimaxQuota: miniMaxQuota,
      deepseekQuota,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('Profile query error:', err);
    return error(res, '查询失败', 500);
  }
});

// 学生自己的调用日志
router.get('/usage', studentAuth, async (req, res) => {
  try {
    const { model, provider, startDate, endDate } = req.query;
    const pageParams = parsePageParams(req.query, 20);
    if (pageParams.error) return error(res, pageParams.error);
    const { page, pageSize } = pageParams;

    if (model && String(model).length > 128) {
      return error(res, 'model 不能超过 128 个字符');
    }
    if (provider && !['mimo', 'minimax', 'deepseek'].includes(provider)) {
      return error(res, 'provider 只支持 mimo / minimax / deepseek');
    }
    const start = parseDateParam(startDate, 'startDate');
    if (start.error) return error(res, start.error);
    const end = parseDateParam(endDate, 'endDate');
    if (end.error) return error(res, end.error);
    if (start.value && end.value && start.value > end.value) {
      return error(res, 'startDate 不能晚于 endDate');
    }

    const conditions = [{ studentId: req.student.studentId }];
    if (model) conditions.push({ model });
    if (provider) conditions.push({ billingProvider: provider });
    if (start.value) conditions.push({ createdAt: _.gte(start.value) });
    if (end.value) conditions.push({ createdAt: _.lte(end.value) });
    const where = conditions.length > 1 ? _.and(...conditions) : conditions[0];

    const { data: records, total } = await db.collection('usage_records')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return success(res, { records, total: total || records.length, page, pageSize });
  } catch (err) {
    console.error('Student usage query error:', err);
    return error(res, '查询失败', 500);
  }
});

// 学生端可用模型
router.get('/models', studentAuth, async (req, res) => {
  try {
    const models = await getAvailableModelDetails();
    const grouped = new Map();

    for (const model of models) {
      const provider = model.provider || 'API Share';
      if (!grouped.has(provider)) grouped.set(provider, []);
      grouped.get(provider).push(model);
    }

    return success(res, {
      models,
      groups: [...grouped.entries()].map(([provider, items]) => ({ provider, items })),
    });
  } catch (err) {
    console.error('Student models query error:', err);
    return error(res, '查询失败', 500);
  }
});

// 重新生成 Key
router.post('/key/regenerate', studentAuth, async (req, res) => {
  try {
    const newKey = generateApiKey();
    const newKeyHash = hashApiKey(newKey);
    const newPrefix = getApiKeyPrefix(newKey);

    await db.collection('users')
      .where({ studentId: req.student.studentId })
      .update({
        apiKeyHash: newKeyHash,
        apiKeyPrefix: newPrefix,
      });

    return success(res, {
      apiKey: newKey,
      note: '新 Key 已生成，旧 Key 已失效',
    });
  } catch (err) {
    return error(res, '重新生成失败', 500);
  }
});

module.exports = router;
