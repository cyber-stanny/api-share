const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');
const { hashApiKey } = require('../utils/crypto');
const { error } = require('../utils/response');

// 学生 JWT 认证
function studentAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '缺少认证信息', 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'student') {
      return error(res, '权限不足', 403);
    }
    req.student = decoded;
    next();
  } catch {
    return error(res, 'Token 无效或已过期', 401);
  }
}

// API Key 认证（代理接口用）
async function apiKeyAuth(req, res, next) {
  // 兼容两种传参：Authorization: Bearer (OpenAI) 和 x-api-key (Anthropic)
  let apiKey;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7);
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  }

  if (!apiKey) {
    const isAnthropic = req.path === '/messages';
    return res.status(401).json(
      isAnthropic
        ? { type: 'error', error: { type: 'authentication_error', message: '缺少 API Key' } }
        : { error: { message: '缺少 API Key', type: 'authentication_error' } }
    );
  }
  const keyHash = hashApiKey(apiKey);

  try {
    const { data } = await db.collection('users').where({ apiKeyHash: keyHash }).limit(1).get();
    if (!data || data.length === 0) {
      const isAnthropic = req.path === '/messages';
      return res.status(401).json(
        isAnthropic
          ? { type: 'error', error: { type: 'authentication_error', message: 'API Key 无效' } }
          : { error: { message: 'API Key 无效', type: 'authentication_error' } }
      );
    }

    req.student = data[0];
    next();
  } catch (err) {
    console.error('API Key auth error:', err);
    return res.status(500).json({
      error: { message: '认证服务异常', type: 'api_error' },
    });
  }
}

module.exports = { studentAuth, apiKeyAuth };
