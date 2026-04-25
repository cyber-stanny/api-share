const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.length === 0) {
    // 未配置时允许所有（兼容本地开发）；试运行/生产环境应显式配置 CORS_ORIGINS。
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

function corsMiddleware(req, res, next) {
  applyCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

module.exports = { applyCorsHeaders, corsMiddleware };
