# 前端重构进度

> MiniMax M2.7 执行

## 总体进度

| 阶段 | 名称 | 状态 | 完成时间 |
|------|------|------|----------|
| 0 | 脚手架 | ✅ 完成 | 2026-05-01 |
| 1 | 抽公共层 | ✅ 完成 | 2026-05-01 |
| 2 | 迁移管理端 | ✅ 完成 | 2026-05-01 |
| 3 | 迁移学生端 | ✅ 完成 | 2026-05-01 |
| 4 | 部署链路收口 | ✅ 完成 | 2026-05-01 |
| 5 | 文档与收尾 | ✅ 完成 | 2026-05-01 |

## 阶段 0：脚手架

- [x] 创建 `frontend/`，初始化 Vite + Vue 3 + TS + Pinia + Vue Router
- [x] 写 `vite.config.ts`，配 MPA 入口和 dev proxy
- [x] 在 `frontend/index.html` 和 `frontend/admin.html` 里只放壳子（挂 `<div id="app">` 和字体 `<link>`）
- [x] 跑通 `npm run dev:frontend` 能打开两个空白页
- [x] **此阶段不动 `src/public/`**，构建输出先写到 `frontend/dist/` 验证

**完成时间**: 2026-05-01

## 阶段 1：抽公共层

- [x] 把 CSS 变量、`* { box-sizing }`、`.btn / .input / .msg / .field / .hidden` 等迁到 `shared/styles/`
- [x] 把 `getMountPath`、`api()`、`escapeHtml`、`fmt*`、`providerLabel` 迁到 `shared/`，加 TS 类型
- [x] 写 `Modal.vue`、`TopBar.vue` 这种两端共用的小组件
- [x] 在 `frontend/admin.html` 里临时挂一个 demo 页验证样式 token 与原 admin 像素一致

**完成时间**: 2026-05-01

## 阶段 2：迁移管理端

- [x] `Login.vue` + `auth` store
- [x] `Sidebar.vue` + `App.vue` 路由壳子
- [x] `Students.vue`：表格 + 添加学生 + 改配额（`QuotaEditor.vue`）+ 重置密码
- [x] `Whitelist.vue`
- [x] `UsageLog.vue`
- [x] 把构建输出切换到 `../src/public/`，删除旧 `src/public/admin.html`
- [x] 端到端验证

**完成时间**: 2026-05-01

## 阶段 3：迁移学生端

- [x] `Landing.vue`：顶栏 + 公开模型列表
- [x] `AuthModal.vue` + `KeyModal.vue`
- [x] `Overview.vue`：profile 卡片 + 配额进度条
- [x] `Guide.vue`：接入指导
- [x] `Usage.vue`：日志表
- [x] `Models.vue` + `ModelGroupList.vue`：分组渲染
- [x] 删除旧 `src/public/index.html`
- [x] 端到端验证

**完成时间**: 2026-05-01

## 阶段 4：部署链路收口

- [x] 更新 `scripts/deploy-cloudbase.sh`
- [x] 更新 GitHub Actions workflow
- [x] 把构建产物路径加进 `.gitignore`

**完成时间**: 2026-05-01

## 阶段 5：文档与收尾

- [x] 更新 `CLAUDE.md`
- [x] 更新 `DEVELOPMENT.md`
- [x] 更新 `CONTRIBUTING.md`
- [x] 创建 `frontend/README.md`

**完成时间**: 2026-05-01
