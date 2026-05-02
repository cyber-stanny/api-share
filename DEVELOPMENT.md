# API Share 开发文档

如果你是仓库共建者，建议先读 [`CONTRIBUTING.md`](CONTRIBUTING.md)，它补充了当前核心实现、文件入口和协作约定。

## 项目概览

大模型 API 中转平台。学生通过学号注册获取 API Key，调用 OpenAI 兼容接口。平台转发到上游（MiMo / MiniMax / DeepSeek），负责额度控制和限流。

支持两种协议：OpenAI 格式（OpenCode 等客户端）和 Anthropic 格式（Claude Code）。

**技术栈**: Node.js + Express + serverless-http + 腾讯云 CloudBase + Vue 3/Vite 前端

## 项目结构

```
api-share/
├── src/
│   ├── app.js                  # Express 主入口
│   ├── db.js                   # CloudBase 数据库初始化
│   ├── config.js               # 配置（环境变量）
│   ├── public/                 # 静态文件（前端构建产物）
│   │   ├── index.html          # 学生端（构建后）
│   │   ├── admin.html          # 管理端（构建后）
│   │   └── assets/             # JS/CSS bundles
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
│   │   ├── modelCatalog.js     # 模型和上游预设
│   │   ├── upstream.js         # 上游路由（带缓存）
│   │   └── usage.js            # 调用日志
│   └── utils/
│       ├── crypto.js           # Key 生成/hash、密码加密
│       └── response.js         # 统一响应格式
├── frontend/                   # 前端源码（Vue 3 + Vite）
│   ├── src/
│   │   ├── shared/             # 两端共用
│   │   │   ├── api/            # client.ts, types.ts
│   │   │   ├── format.ts       # 格式化函数
│   │   │   ├── styles/         # CSS tokens, base, controls
│   │   │   └── components/      # Modal, TopBar, EmptyState
│   │   ├── student/            # 学生端
│   │   │   ├── views/          # Landing, Overview, Guide, Usage, Models
│   │   │   ├── components/     # AuthModal, KeyModal, ModelGroupList
│   │   │   └── stores/         # auth, dashboard
│   │   └── admin/              # 管理端
│   │       ├── views/          # Login, Students, Whitelist, UsageLog
│   │       ├── components/      # Sidebar, QuotaEditor
│   │       └── stores/         # auth
│   ├── index.html              # 学生端入口模板
│   ├── admin.html             # 管理端入口模板
│   └── vite.config.ts         # 构建配置
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

> CloudBase 免费版存在请求体大小等平台限制，不适合作为大模型 API 代理承载大文件或长上下文请求。设置 `PROXY_ENABLED=false` 后，`/api/auth`、`/api/admin` 和页面仍可用于注册、登录、白名单管理和 API Key 发放，`/v1/*` 会返回 503 提示代理已关闭。

### 上游协议支持

| 上游 | OpenAI (`/v1/chat/completions`) | Anthropic (`/v1/messages`) |
|------|------|------|
| Mimo | mimo-v2.5-pro, mimo-v2.5, mimo-v2-pro, mimo-v2-omni | mimo-v2.5-pro, mimo-v2.5, mimo-v2-pro, mimo-v2-omni |
| MiniMax | MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5, MiniMax-M2.5-highspeed, MiniMax-M2.1, MiniMax-M2.1-highspeed, MiniMax-M2 | MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-M2.5, MiniMax-M2.5-highspeed, MiniMax-M2.1, MiniMax-M2.1-highspeed, MiniMax-M2 |
| DeepSeek | deepseek-v4-flash, deepseek-v4-pro | deepseek-v4-flash, deepseek-v4-pro |

MiniMax 学生端默认推荐使用 `MiniMax-M2.7` 和 `MiniMax-M2.7-highspeed`，接入指导里也按这两个模型写。后续如果 MiniMax Token Plan 继续开放新的文本模型，只要仍然兼容当前代理协议，就可以继续加到 `upstreams.models` 里。

当前学生额度口径已经拆分：

- MiMo：继续沿用 token 额度
- MiMo `mimo-v2.5`：按 2 倍 token 计入额度
- MiniMax：按调用次数统计，默认 `1000` 次/日，`4000` 次/周，`highspeed` 先按 1 次调用计
- DeepSeek：按 token 额度统计，并在调用日志和概览中展示按官方价格计算的人民币消耗

注意：当前项目只代理文本接口 `POST /v1/chat/completions` 和 `POST /v1/messages`，所以像 MiMo 的 TTS 这类非文本模型会被自动过滤，不会出现在学生端列表里，也不会被 `/v1/models` 暴露出来。

### 管理页面
- `GET /admin` - 管理后台 SPA

## 数据库集合

| 集合 | 说明 |
|------|------|
| users | 学生用户（studentId, passwordHash, apiKeyHash, quota: {dailyTokenLimit, weeklyTokenLimit}）|
| whitelist | 学号白名单 |
| upstreams | 上游渠道（name, baseUrl, apiKey, models[], protocol: openai|anthropic）|
| usage_records | 调用日志（studentId, model, tokens, billingProvider, billingCostCny, status）|
| token_counters | Token/请求用量计数器（MiMo、DeepSeek、MiniMax 分字段），按日/周自动重置 |
| admins | 管理员账号 |

`upstreams` 是运行时配置表，不是学生业务数据。它保存的是：

- 上游名字和供应商标识
- `baseUrl`
- `apiKey`
- 支持的 `models[]`
- `protocol`（`openai` / `anthropic`）
- `enabled`
- `priority`

学生账号、白名单、调用日志、额度计数都在其他集合里，不和上游密钥混在一起。

## 部署流程

### 独立服务器部署（推荐第一阶段）

完整 Express 应用可以直接部署到云服务器，数据库继续使用 CloudBase。服务器部署时设置 `PROXY_ENABLED=true`，并配置 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 访问 CloudBase 数据库。

详细步骤见 [docs/server-deploy.md](docs/server-deploy.md)。

### CloudBase 函数部署

1. 在腾讯云创建 CloudBase 环境
2. 在 GitHub 设置 Secrets: TCB_SECRET_ID, TCB_SECRET_KEY, CLOUDBASE_ENV_ID, JWT_SECRET, ADMIN_INIT_PASSWORD, MIMO_API_KEY
   - 可选：CORS_ORIGINS, PROXY_ENABLED, MINIMAX_API_KEY, DEEPSEEK_API_KEY
3. push 到 main 分支自动部署
4. 首次部署后运行初始化脚本：
   ```bash
   CLOUDBASE_ENV_ID=xxx node scripts/init-admin.js
   CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js
   ```
5. 在数据库或管理后台中修改 upstreams 的 apiKey 为真实 Key
6. 如果要接入 MiniMax / DeepSeek，补上 `MINIMAX_API_KEY` / `DEEPSEEK_API_KEY` 并保留 `upstreams` 里对应记录

## 本地开发

```bash
cp .env.example .env  # 填入配置
npm install
npm install --prefix frontend  # 安装前端依赖

# 终端 A：后端
npm start             # http://localhost:3000

# 终端 B：前端（热重载）
npm run dev:frontend  # http://localhost:5173
```

前端开发服务器会自动代理 `/api`、`/v1` 到 `localhost:3000`。管理端开发入口是 `http://localhost:5173/admin.html`；生产环境由后端在 `http://localhost:3000/admin` 服务 `src/public/admin.html`。

构建生产版本：`npm run build:frontend`（输出到 `src/public/`）

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
