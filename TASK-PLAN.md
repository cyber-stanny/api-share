# API Share · 落地计划

> 创建日期：2026-04-25
> 目标：将 Takram 风格原型（prototype.html）落地为真实可用的前后端系统

## 当前状态

- **后端**：API 骨架完整（auth、admin CRUD、proxy 代理），已补学生端 profile / usage / models 查询接口
- **前端**：已有管理后台和一版可上线学生端单页（`src/public/index.html`），支持注册、登录、Key 管理、接入指导和用量查看
- **原型**：`prototype.html` 已完成 7 屏 Takram 风格高保真原型（不参与运行，仅作设计参考）
- **试运行目标**：先给约 30 个学生内部使用，优先保证 API Key、额度、限流和后台管理不出现明显安全/稳定性问题

## Phase 0 · 内部试运行前必须修

> 目标不是做完整生产级网关，而是先规避 30 人内部试运行中最容易造成服务不可用、额度绕过或后台暴露的问题。Phase 0 完成前，不建议把真实上游 Key 暴露给学生使用。

### P0-1 — 修复 streaming 并发计数泄漏
- **状态**：已修复
- **文件**：`src/routes/proxy.js`
- **问题**：`stream=true` 请求在模型不存在、上游返回非 2xx、fetch 超时/报错时，外层 `finally` 不会调用 `releaseConcurrent()`。连续异常请求可能耗尽全局并发池，导致正常请求一直返回“系统繁忙”。
- **要求**：
  - 每次 `acquireConcurrent()` 成功后，无论 streaming/non-streaming、成功/失败/提前返回，都必须且只释放一次。
  - streaming 客户端断开时，应结束上游读取并释放并发。
- **验收**：
  - 构造 `stream=true` + 不存在模型，请求结束后并发计数恢复。
  - 构造 `stream=true` + 上游错误/超时，请求结束后并发计数恢复。

### P0-2 — 统一并收紧 CORS
- **状态**：已修复
- **文件**：`src/app.js`、`src/routes/proxy.js`、`.env.example`、`cloudbaserc.json`
- **问题**：全局 CORS 支持 `CORS_ORIGINS`，但 streaming 响应里仍硬编码 `Access-Control-Allow-Origin: *`，会绕过配置。
- **要求**：
  - 生产/试运行环境必须显式配置 `CORS_ORIGINS`，不要默认对公网全放开。
  - streaming 响应复用同一套 CORS 逻辑，不单独写 `*`。
  - `.env.example` 和 CloudBase 部署配置补上 `CORS_ORIGINS`。
- **验收**：
  - 配置允许域名时，非白名单 Origin 不返回 `Access-Control-Allow-Origin`。
  - streaming 和普通 JSON 接口行为一致。

### P0-3 — 后台和额度接口做严格输入校验
- **状态**：已修复
- **文件**：`src/routes/admin.js`
- **问题**：额度、分页、日期等参数直接 `parseInt` 或 `new Date`，未校验 `NaN`、负数、超大值、日额度大于周额度等情况，可能造成额度逻辑失效或数据库慢查询。
- **要求**：
  - `dailyTokenLimit`、`weeklyTokenLimit` 必须是非负整数。
  - `weeklyTokenLimit >= dailyTokenLimit`，除非显式允许 0 表示禁用。
  - `page >= 1`，`pageSize` 限制在合理范围，例如 1-100。
  - `startDate`、`endDate` 必须是有效日期，且 `startDate <= endDate`。
  - `/api/admin/usage` 增加 `model` 筛选时也要校验和限制长度。
- **验收**：
  - 提交 `NaN`、负数、空字符串、超大分页时返回 400。
  - 合法额度更新后 `checkQuota` 行为正常。

### P0-4 — 计费写入必须可观测
- **状态**：已修复
- **文件**：`src/routes/proxy.js`、`src/services/quota.js`
- **问题**：`addTokens(...)` 当前没有 `await`/catch。数据库写入失败时，用户请求可能成功但额度没有扣，管理员也难以及时发现。
- **要求**：
  - 非 streaming 响应中，记录 usage 和 token 累加至少要 `await` 或显式捕获错误并记录日志。
  - streaming 响应结束后，usage 记录和 token 累加失败必须打出带 `studentId/model/upstreamId` 的错误日志。
  - 明确策略：内部试运行阶段优先保证计费准确，建议等待扣费完成再结束请求；如选择异步扣费，必须有失败告警/补偿方案。
- **验收**：
  - 模拟 `addTokens` 抛错时，不出现 unhandled rejection。
  - 日志能定位到具体学生和模型。

### P0-5 — 学生注册/登录加限流
- **状态**：已修复
- **文件**：`src/routes/auth.js`、可选新建 `src/middleware/rateLimiter.js`
- **问题**：管理员登录已有 IP 限流，但学生登录和注册没有限流。内部试运行也可能被脚本撞库、刷注册或打爆数据库。
- **要求**：
  - `/api/auth/login`：按 IP + studentId 限制尝试频率。
  - `/api/auth/register`：按 IP 限制注册频率，并限制单次请求体长度。
  - 复用管理员登录限流逻辑，避免在多个文件里复制 Map 清理代码。
- **验收**：
  - 连续错误登录超过阈值返回 429。
  - 换不同 studentId 不应完全绕过同一 IP 的限制。

### P0-6 — 依赖安全风险处理
- **状态**：已缓解，剩余风险需 P1 单独验证 CloudBase SDK 3.x 升级
- **文件**：`package.json`、`package-lock.json`
- **问题**：`npm audit --omit=dev` 发现 11 个漏洞，其中 2 个 critical、5 个 high，主要来自 `@cloudbase/node-sdk@^2.0.0` 的传递依赖。
- **要求**：
  - 先尝试 `npm audit fix` 处理非 breaking 修复。
  - 单独评估 `@cloudbase/node-sdk` 升级到 3.x 的兼容性，不直接盲升生产。
  - 如果短期不能升 SDK，需要在试运行文档中明确风险和隔离措施：仅内网/受控域名、强 JWT、强管理员密码、限制注册、监控异常调用。
- **验收**：
  - 记录升级前后的 `npm audit --omit=dev` 输出。
  - 本地启动、登录、注册、代理、CloudBase 数据库读写至少手测通过。

### P1-1 — token_counters 多实例一致性方案
- **文件**：`src/services/quota.js`
- **问题**：当前 per-studentId 互斥锁只在单个 Node 进程内有效；CloudBase serverless 多实例时仍可能重复创建 `token_counters`，导致用量读取不稳定。
- **要求**：
  - 优先使用固定 doc id 或数据库唯一约束来保证 `studentId` 只有一个 counter。
  - 如果 CloudBase 不方便做唯一约束，至少提供一次性去重脚本和后台检测脚本。
- **验收**：
  - 同一学生并发首次调用后，数据库中只保留一个有效 counter。

### P1-2 — 上游失败和长连接兜底
- **文件**：`src/routes/proxy.js`
- **问题**：当前只有 fetch 建连 30s timeout，streaming 建连后缺少 idle timeout；客户端断开时也没有主动 abort 上游。
- **要求**：
  - 客户端 `close` 时 abort upstream fetch/reader。
  - streaming 长时间无数据时主动中断并记录失败。
  - 上游余额不足、401/429/5xx 的错误要保留上游状态码和日志。
- **验收**：
  - 客户端中途断开后服务端不继续占用并发。
  - 上游错误能在 usage_records 中留下状态。

### P1-3 — 试运行部署检查清单
- **文件**：`.env.example`、`DEVELOPMENT.md` 或新建 `RUNBOOK.md`
- **要求**：
  - `JWT_SECRET` 使用强随机值。
  - `ADMIN_INIT_PASSWORD` 不使用默认值，首次初始化后立即修改或重建管理员密码。
  - `CORS_ORIGINS` 只允许实际学生端/管理端域名。
  - 上游 API Key 不写入代码和文档。
  - 白名单先导入 30 个学生，注册入口只对白名单开放。
  - 设置默认额度为试运行保守值，避免单人耗尽上游预算。
  - 管理员每天检查 usage_records、token_counters、上游余额。

## 任务拆解

### Phase 1 · 后端补全

#### Task 1.1 — `GET /api/auth/profile`
- **状态**：已完成
- **文件**：`src/routes/auth.js`
- **功能**：学生登录后查看自己的完整信息
- **返回**：
  ```json
  {
    "studentId": "2024010001",
    "name": "张同学",
    "apiKeyPrefix": "sk-7f3a...b9c4",
    "quota": { "dailyTokenLimit": 50000, "weeklyTokenLimit": 250000 },
    "dailyTokensUsed": 12480,
    "weeklyTokensUsed": 186200,
    "createdAt": "2026-03-15T..."
  }
  ```
- **依赖**：查 `users` 表 + `token_counters` 表（和 admin.js 里的 `/students` 逻辑类似，但只查自己的）
- **需要**：`studentAuth` 中间件

#### Task 1.2 — `GET /api/auth/usage`
- **状态**：已完成
- **文件**：`src/routes/auth.js`（或新建 `src/routes/usage.js`）
- **功能**：学生查自己的用量记录，支持筛选和聚合
- **查询参数**：
  - `model` — 按模型筛选（可选）
  - `startDate` / `endDate` — 时间范围（可选）
  - `page` / `pageSize` — 分页（默认 1 / 50）
- **返回**：
  ```json
  {
    "records": [
      { "time": "2026-04-25T14:32:08Z", "model": "glm-5.1", "inputTokens": 500, "outputTokens": 1342, "totalTokens": 1842, "status": 200 }
    ],
    "total": 156,
    "page": 1,
    "pageSize": 50
  }
  ```
- **依赖**：查 `usage_records` 表，按 `studentId` 筛选（参考 admin.js 里 `/usage` 的写法）
- **需要**：`studentAuth` 中间件

#### Task 1.3 — `GET /api/auth/models`（可选，P1）
- **状态**：已完成
- **文件**：`src/routes/auth.js`
- **功能**：返回可用模型列表
- **返回**：
  ```json
  {
    "models": [
      { "id": "glm-5.1", "name": "GLM-5.1", "provider": "硅基流动", "protocol": "openai" },
      { "id": "mimo-v2.5-pro", "name": "Mimo-V2.5-Pro", "provider": "Mimo Token Plan", "protocol": "anthropic" }
    ]
  }
  ```
- **依赖**：查 `upstreams` 表，提取去重后的模型列表
- **备选**：前端写死模型列表，跳过此接口

### Phase 2 · 学生端前端

#### Task 2.1 — 注册 / 登录页面
- **状态**：已完成（合并在 `src/public/index.html`）
- **文件**：新建 `src/public/index.html`
- **内容**：Landing Page + 登录/注册表单（原型第 1、2 屏）
- **对接 API**：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - 登录成功后 JWT 存 localStorage
- **路由**：`app.js` 加 `GET /` 返回此页面

#### Task 2.2 — 学生 Dashboard
- **状态**：已完成（合并在 `src/public/index.html`）
- **文件**：新建 `src/public/dashboard.html`（或合并到 index.html 用路由切换）
- **内容**：API Key 展示、今日/本周用量卡片、近 7 日趋势图、可用模型列表（原型第 3 屏）
- **对接 API**：
  - `GET /api/auth/profile` — 用量数据
  - `GET /api/auth/key` — Key 前缀
- **路由**：`app.js` 加 `GET /dashboard`

#### Task 2.3 — 用量详情（带模型筛选）
- **状态**：基础版已完成（调用日志已接入；模型筛选后续可增强）
- **内容**：小时级分布图 + 调用日志表格 + 模型筛选 pills（原型第 4 屏）
- **对接 API**：
  - `GET /api/auth/usage?model=xxx` — 筛选后的日志
  - `GET /api/auth/profile` — 各模型汇总数据

### Phase 3 · 管理后台改版

#### Task 3.1 — 视觉改造
- **文件**：`src/public/admin.html`
- **改动**：
  - 配色：indigo `#4f46e5` → 鼠尾草绿 `#6B8F71` / 赤陶 `#C47A5A`
  - 字体：system stack → Noto Sans JP
  - 圆角 + 阴影改为 Takram 风格
  - 侧边栏改为暖色调

#### Task 3.2 — 学生详情页
- **内容**：个人信息卡片、额度表单、危险操作区（原型第 6 屏）
- **对接 API**：
  - `GET /api/admin/students` — 已有
  - `PUT /api/admin/students/:id/quota` — 已有

#### Task 3.3 — 模型筛选
- **内容**：用量日志加模型筛选 pills（原型第 4 屏的筛选逻辑，管理端也要有）
- **对接 API**：`GET /api/admin/usage?model=xxx`（需要确认现有接口是否支持 model 参数）

### Phase 4 · 路由和部署

#### Task 4.1 — app.js 路由注册
- `GET /` → `index.html`（Landing + Auth）
- `GET /dashboard` → `dashboard.html`
- `GET /admin` → `admin.html`（已有）

#### Task 4.2 — 验证
- 本地 `npm start` 跑通所有页面
- 学生注册 → 登录 → 看 Dashboard → 看用量筛选 → 管理后台全功能
- 检查 API 响应格式和前端渲染一致性

## 优先级总结

```
Phase 0（安全加固）> Phase 1（后端）> Phase 2（学生前端）> Phase 3（管理后台改版）> Phase 4（收尾）
```

**内部试运行最小可交付**：Phase 0 P0 全部完成 + Task 1.1 + 1.2 + 2.1 + 2.2 = 学生能注册、登录、看自己的用量，并且 API Key、额度、限流、CORS 和计费路径没有明显漏洞。

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `prototype.html` | 设计原型参考（不参与运行） |
| `src/routes/auth.js` | 学生端 API（需补 profile + usage） |
| `src/routes/admin.js` | 管理端 API（基本完整） |
| `src/routes/proxy.js` | 代理转发（不用改） |
| `src/app.js` | Express 主入口（需加路由） |
| `src/public/admin.html` | 管理后台前端（需改版） |
| `src/public/index.html` | （待建）学生端 Landing + Auth |
| `src/public/dashboard.html` | （待建）学生端 Dashboard |
