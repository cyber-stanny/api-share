# API Share 共建指南

这份文档面向仓库共建者，说明项目做什么、核心实现在哪里、改动时要注意什么。

## 项目定位

API Share 是一个大模型 API 中转平台，面向学生用户提供：

- 学号白名单注册
- 登录后查看和重置 API Key
- OpenAI 兼容接口代理
- Anthropic 兼容接口代理
- 学生端按 Token Plan provider 维度查看模型和用量
- 后台管理学生、白名单、额度和调用日志

当前支持的上游主要是：

- MiMo Token Plan
- MiniMax Token Plan
- 硅基流动

## 核心架构

请求路径是：

`Client -> Express App -> Auth / Rate Limit / Quota -> Upstream 选择 -> 代理转发 -> 记录用量`

关键入口文件：

- [`src/app.js`](src/app.js)
- [`src/routes/auth.js`](src/routes/auth.js)
- [`src/routes/admin.js`](src/routes/admin.js)
- [`src/routes/proxy.js`](src/routes/proxy.js)
- [`src/config.js`](src/config.js)

## 核心实现

### 1. 应用入口

[`src/app.js`](src/app.js) 负责：

- 挂载 JSON body parser
- 注入 CORS
- 打印请求日志
- 提供 `/health`
- 挂载学生端页面和管理端页面
- 按 `PROXY_ENABLED` 控制是否开放 `/v1/*`

如果 `PROXY_ENABLED=false`，系统仍然可以做注册、登录、管理和发放 Key，但代理接口会直接返回 `503`。

### 2. 认证体系

项目里有两套认证：

- JWT：用于学生和管理员登录后的管理接口
- API Key：用于 `/v1/*` 代理请求

实现位置：

- [`src/routes/auth.js`](src/routes/auth.js)
- [`src/routes/admin.js`](src/routes/admin.js)
- [`src/middleware/auth.js`](src/middleware/auth.js)
- [`src/middleware/adminAuth.js`](src/middleware/adminAuth.js)

要点：

- 学生注册时只返回一次明文 API Key
- 数据库里只保存 API Key 的 SHA-256 哈希
- 登录态用 JWT，不直接拿来调用代理

### 3. 代理请求

[`src/routes/proxy.js`](src/routes/proxy.js) 是最核心的文件。

它做的事情依次是：

1. API Key 鉴权
2. 每分钟请求频率限制
3. 全局并发限制
4. 按模型和协议选择上游
5. 额度检查
6. 上游并发队列控制
7. 转发请求
8. 记录调用日志和用量

当前支持两类协议：

- OpenAI 格式：`/v1/chat/completions`
- Anthropic 格式：`/v1/messages`

流式响应也被支持，代理会尽量解析上游返回的 usage，再回写到用量统计里。

### 4. 额度与计费口径

Token 型额度在 [`src/services/quota.js`](src/services/quota.js) 中维护。

目前有两套口径：

- MiMo / 硅基流动：按 token 统计
- MiniMax：按调用次数统计

MiniMax 的特殊点：

- `highspeed` 模型不单独额外加倍
- 默认每日 `1000` 次、每周 `4000` 次
- 对应计数存放在 `token_counters` 里，同一学生同时维护 token 和 request 两套指标

### 5. 上游选择与模型目录

上游选择在 [`src/services/upstream.js`](src/services/upstream.js)。

模型目录和特殊映射在 [`src/services/modelCatalog.js`](src/services/modelCatalog.js)。

实现原则：

- `upstreams` 集合保存运行时上游配置
- 同一模型可挂多个上游
- 优先级高的上游优先
- 同优先级时随机挑一个，降低单点压力
- 非文本模型不会对外暴露

### 6. 调用日志与统计

调用日志写入在 [`src/services/usage.js`](src/services/usage.js)。

统计展示主要来自：

- `usage_records`
- `token_counters`
- `users`

管理员和学生都能查看自己的用量和调用历史，管理员可以看到更完整的列表。
学生端还会把模型按 provider 分组展示，当前主要是 MiMo Token Plan 和 MiniMax Token Plan，并在概览里展示 MiMo token 用量和 MiniMax 调用次数用量。

## 数据集合

当前主要集合如下：

- `users`：学生账号、密码哈希、API Key 哈希、额度
- `admins`：管理员账号
- `whitelist`：允许注册的学号
- `upstreams`：上游配置
- `usage_records`：调用日志
- `token_counters`：token 与 MiniMax 次数统计

`upstreams` 不是学生业务数据，而是运行时配置源。不要把学生数据和上游密钥混放到别的集合里。

## 仓库共建者的工作方式

### 修改前先看这几个文件

- [`DEVELOPMENT.md`](DEVELOPMENT.md)
- [`RUNBOOK.md`](RUNBOOK.md)
- [`src/config.js`](src/config.js)
- [`src/routes/proxy.js`](src/routes/proxy.js)

### 改动建议

- 新增模型或上游，优先改 `src/services/modelCatalog.js` 和 `src/services/upstream.js`
- 变更额度逻辑，优先改 `src/services/quota.js`
- 变更鉴权，优先改 `src/middleware/auth.js` 或 `src/middleware/adminAuth.js`
- 变更管理能力，优先改 `src/routes/admin.js`
- 变更学生端能力，优先改 `src/routes/auth.js`

### 需要谨慎的地方

- API Key 只在注册或重置时明文返回一次
- 管理员密码不要写死在代码里
- `PROXY_ENABLED=false` 时不要假设代理接口可用
- 内存限流在多实例部署下不是全局一致的
- CloudBase 免费版和独立服务器的部署行为不同

### 环境变量

至少需要关注这些变量：

- `CLOUDBASE_ENV_ID`
- `JWT_SECRET`
- `ADMIN_INIT_PASSWORD`
- `CORS_ORIGINS`
- `PROXY_ENABLED`
- `MIMO_API_KEY`
- `MINIMAX_API_KEY`
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

`/.env.example` 会随着功能演进继续保持同步，新增环境变量时记得先补模板。

## 本地开发

```bash
cp .env.example .env
npm install
npm start
```

常见验证路径：

- 打开 `/health`
- 检查 `/api/auth/register`
- 检查 `/api/auth/login`
- 检查 `/api/admin/login`
- 检查 `/v1/models`

## 部署提示

- CloudBase 云函数部署：适合轻量运行和快速发放 Key
- 独立服务器部署：适合完整代理能力和更稳定的流式转发

更详细的部署说明见：

- [`DEVELOPMENT.md`](DEVELOPMENT.md)
- [`RUNBOOK.md`](RUNBOOK.md)
- [`docs/server-deploy.md`](docs/server-deploy.md)

## 额外说明

如果你在改动前不确定一个文件是不是“工具性文档”还是“历史遗留文档”，优先保留运行时配置、部署文档和故障手册，删掉纯计划稿、旧任务单和原型参考文件。
