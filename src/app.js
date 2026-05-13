require('dotenv').config();
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const proxyRoutes = require('./routes/proxy');
const { corsMiddleware } = require('./middleware/cors');
const config = require('./config');

const app = express();

// 中间件
app.use(express.json({ limit: '10mb' }));

// CORS
app.use(corsMiddleware);

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', name: 'API Share', version: '1.0.0' });
});

// 学生端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
if (config.proxy.enabled) {
  app.use('/v1', proxyRoutes);
} else {
  app.use('/v1', (req, res) => {
    res.status(503).json({
      error: {
        message: '当前 CloudBase 部署仅用于注册、管理和发放 API Key，API 代理已关闭。',
        type: 'service_unavailable',
      },
    });
  });
}

// 管理后台页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 本地开发模式
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`API Share running on http://localhost:${port}`);
  });
}

module.exports = app;
