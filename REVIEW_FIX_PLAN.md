# Review 修复计划

> 基于 2026-04-24 代码审查，按优先级排序。每项完成后打勾。

## P0 必修（安全 / 会出错）

- [x] **1. JWT Secret 硬编码 fallback**
  - 文件: `src/config.js`
  - 修复: 缺少 `JWT_SECRET` 时 `process.exit(1)` 阻止启动

- [x] **2. admin.html XSS 漏洞**
  - 文件: `src/public/admin.html`
  - 修复: 添加 `escapeHtml()`，所有 `innerHTML` 动态内容已转义

- [x] **3. Streaming 请求上游返回错误状态码处理**
  - 文件: `src/routes/proxy.js`
  - 修复: `upstreamRes.ok` 检查移到 streaming 分支之前，错误统一返回 JSON

## P1 建议修（安全 / 稳定性）

- [x] **4. CORS 限制**
  - 文件: `src/app.js`
  - 修复: 新增 `CORS_ORIGINS` 环境变量，未配置时兼容保留 `*`

- [x] **5. 管理员登录端点加限流**
  - 文件: `src/routes/admin.js`
  - 修复: IP 级别 5 次/分钟登录频率限制

- [x] **6. setInterval 在 serverless 下不可靠**
  - 文件: `src/services/rateLimit.js`
  - 修复: 去掉 `setInterval`，改为 `lazyCleanup()` 惰性清理

- [x] **7. addTokens 竞态条件 — 重复计数器**
  - 文件: `src/services/quota.js`
  - 修复: 添加 per-studentId 互斥锁 + 创建前二次检查

## P2 可优化（代码质量 / 体验）

- [x] **8. proxy.js 代码去重**
  - 文件: `src/routes/proxy.js`
  - 修复: 提取 `handleProxy(req, res, protocol)` + `PROTOCOLS` 配置对象，从 ~400 行降至 ~240 行

- [x] **9. 上游 fetch 加 timeout**
  - 文件: `src/routes/proxy.js`
  - 修复: `AbortController` + 30s 超时，两处端点均已添加

- [x] **10. 清理死代码**
  - 文件: `src/config.js`、`src/routes/admin.js`
  - 修复: 删除 `supportedModels` 和未使用的 `query` 变量

- [x] **11. admin.html switchTab 的 event 问题**
  - 文件: `src/public/admin.html`
  - 修复: `switchTab(name, event)` 显式传参

## P3 后续可做（新功能，不在本次范围）

- [ ] 学生自助查询用量页面
- [ ] 管理员重置学生密码
- [ ] API Key 单独撤销功能
- [ ] 用量 CSV 导出
- [ ] 上游健康检查 / 自动降权
- [ ] 单元测试 + ESLint

---

## 完成总结

11 项修复全部完成（2026-04-24）。涉及文件：
- `src/config.js` — JWT 检查 + 删除死代码
- `src/app.js` — CORS 可配置化
- `src/public/admin.html` — XSS 修复 + event 传参
- `src/routes/proxy.js` — streaming 错误处理 + 代码去重 + timeout
- `src/routes/admin.js` — 登录限流 + 删除死代码
- `src/services/rateLimit.js` — 惰性清理替代 setInterval
- `src/services/quota.js` — 互斥锁防竞态
