# API Share 开发文档

## 项目概览

大模型 API 中转平台。学生通过学号注册获取 API Key，调用 OpenAI 兼容接口。平台转发到上游（硅基流动 / Mimo），负责额度控制和限流。

支持两种协议：OpenAI 格式（OpenCode 等客户端）和 Anthropic 格式（Claude Code）。

**技术栈**: Node.js + Express + serverless-http + 腾讯云 CloudBase

## 项目结构

```
api-share/
├── src/
│   ├── app.js                  # Express 主入口
│   ├── db.js                   # CloudBase 数据库初始化
│   ├── config.js               # 配置（环境变量）
│   ├── public/admin.html       # 管理后台页面（单文件 SPA）
│   ├── middleware/
│   │   ├── auth.js             # 学生 JWT + API Key 认证
│   │   └── adminAuth.js        # 管理员 JWT 认证
│   ├── routes/
│   │   ├── auth.js             # 注册/登录/Key 管理
│   │   ├── admin.js            # 管理后台 API
│   │   └── proxy.js            # API 代理（核心）
│   ├── services/
│   │   ├── quota.js            # 额度检查/统计
│   │   ├── rateLimit.js        # 内存限流
│   │   ├── upstream.js         # 上游路由（带缓存）
│   │   └── usage.js            # 调用日志
│   └── utils/
│       ├── crypto.js           # Key 生成/hash、密码加密
│       └── response.js         # 统一响应格式
├── scripts/
│   ├── init-admin.js           # 初始化管理员账号
│   └── seed-upstreams.js       # 初始化上游渠道配置
├── .github/workflows/deploy.yml  # GitHub Actions 部署
├── cloudbaserc.json            # CloudBase 部署配置
├── package.json
└── .env.example                # 环境变量模板
```

## API 接口

### 认证
- `POST /api/auth/register` - 学号注册（校验白名单）
- `POST /api/auth/login` - 登录返回 JWT
- `GET /api/auth/key` - 查看 Key 前缀
- `POST /api/auth/key/regenerate` - 重新生成 Key

### 管理后台
- `POST /api/admin/login` - 管理员登录
- `GET /api/admin/students` - 学生列表+用量
- `PUT /api/admin/students/:id/quota` - 调整额度
- `POST /api/admin/students` - 添加学生
- `GET/POST/DELETE /api/admin/whitelist` - 白名单管理
- `GET /api/admin/usage` - 调用日志

### API 代理
- `GET /v1/models` - 模型列表（OpenAI 格式）
- `POST /v1/chat/completions` - 代理请求（OpenAI 格式，适用于 OpenCode 等）
- `POST /v1/messages` - 代理请求（Anthropic 格式，适用于 Claude Code）

### 上游协议支持

| 上游 | OpenAI (`/v1/chat/completions`) | Anthropic (`/v1/messages`) |
|------|------|------|
| 硅基流动 | glm-4-flash, glm-4-plus, moonshot-v1-8k/32k/128k | 不支持 |
| Mimo | mimo-v2.5-pro | mimo-v2.5-pro |

### 管理页面
- `GET /admin` - 管理后台 SPA

## 数据库集合

| 集合 | 说明 |
|------|------|
| users | 学生用户（studentId, passwordHash, apiKeyHash, quota: {dailyTokenLimit, weeklyTokenLimit}）|
| whitelist | 学号白名单 |
| upstreams | 上游渠道（name, baseUrl, apiKey, models[], protocol: openai|anthropic）|
| usage_records | 调用日志（studentId, model, tokens, status）|
| token_counters | Token 用量计数器（studentId, dailyTokens, weeklyTokens），按日/周自动重置 |
| admins | 管理员账号 |

## 部署流程

1. 在腾讯云创建 CloudBase 环境
2. 在 GitHub 设置 Secrets: TCB_SECRET_ID, TCB_SECRET_KEY, CLOUDBASE_ENV_ID, JWT_SECRET, ADMIN_INIT_PASSWORD
3. push 到 main 分支自动部署
4. 首次部署后运行初始化脚本：
   ```bash
   CLOUDBASE_ENV_ID=xxx node scripts/init-admin.js
   CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js
   ```
5. 在数据库或管理后台中修改 upstreams 的 apiKey 为真实 Key

## 本地开发

```bash
cp .env.example .env  # 填入配置
npm install
npm start             # http://localhost:3000
```

## JWT 令牌说明

JWT（JSON Web Token）是本项目的核心认证机制，相当于"临时通行证"。

### 流程

1. **登录**：用户（学生或管理员）用账号密码登录，服务器验证通过后签发一个 JWT 令牌返回给客户端
2. **携带令牌**：客户端后续请求在 HTTP Header 中带上这个令牌：`Authorization: Bearer <token>`
3. **验证令牌**：服务器收到请求后，用 `JWT_SECRET` 密钥验证令牌是否有效、是否过期
4. **令牌过期**：令牌有有效期（当前为 24 小时），过期后需要重新登录获取新令牌

### 本项目中 JWT 的使用场景

| 角色 | 登录接口 | 令牌用途 |
|------|---------|---------|
| 学生 | `POST /api/auth/login` | 查看/重新生成 API Key |
| 管理员 | `POST /api/admin/login` | 管理学生、白名单、查看日志 |

### 关键点

- **JWT_SECRET**：生成和验证令牌的签名密钥，存在 GitHub Secrets / 环境变量中，不要硬编码到代码里
- **无状态**：服务器不需要存储会话信息，令牌本身包含了用户身份，天然适合云函数
- **不是 API Key**：JWT 令牌用于登录后的管理操作；真正的 API 调用（`/v1/chat/completions`）使用的是 API Key，两者是不同的东西

## 待办

- [ ] 上游频率限制：遇到问题再调整
- [ ] 管理员密码修改功能
- [ ] 调用日志分页导出
