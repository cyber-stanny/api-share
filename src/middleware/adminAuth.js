const jwt = require('jsonwebtoken');
const config = require('../config');
const { error } = require('../utils/response');

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '缺少认证信息', 401);
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'admin') {
      return error(res, '权限不足', 403);
    }
    req.admin = decoded;
    next();
  } catch {
    return error(res, 'Token 无效或已过期', 401);
  }
}

module.exports = { adminAuth };
