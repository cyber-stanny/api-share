# 前端重构计划：从单文件 HTML 到组件化 SPA

## 1. 背景与目标

当前 `src/public/admin.html`（25 KB / 519 行）和 `src/public/index.html`（44 KB / 1037 行）都是把 CSS、模板、脚本全部塞进一个 `<style>` + `<script>` 的"单体 HTML"。这种结构在项目早期很省事，但已经暴露出几个问题：

- **迭代成本高**：改一个表格列、一个弹窗，必须在上千行的混合文件里翻找。
- **token 消耗大**：每次让 AI 修改都要把整文件读进上下文，token 用量呈线性增长。
- **复用差**：两个页面之间存在大量重复（CSS 设计 token、`getMountPath`、`api()`、formatter、模态框、登录卡片等）但都是各自手写一份。
- **没有类型/校验**：JS 全靠手感，重构时容易漏改字段名。
- **可维护性差**：未来若加新页面（例如教师端、计费报表）会继续重复这条老路。

目标：在 **不改变后端 API、不改变现有视觉风格** 的前提下，把前端拆成基于构建工具的组件化 SPA，让每次迭代只需要触达单个组件文件，长期维护和 AI 协作都更轻量。

## 2. 现状盘点

### 2.1 学生端 `index.html`

- 顶栏 + Landing（公开） + Dashboard（登录后）两态。
- 弹窗：登录/注册（含重置密码子表单）、API Key 展示。
- Dashboard 视图：概览 / 接入指导 / 调用量 / 模型，对应 `switchView()`。
- 公共逻辑：`getMountPath`、`api()`、`fmt*`、`providerLabel`、`groupModelsByProvider`、`renderModelGroups`。

### 2.2 管理端 `admin.html`

- 顶栏 + 侧边栏，登录后单 Dashboard，3 个 tab。
- 视图：学生管理 / 白名单 / 调用日志，对应 `switchTab()`。
- 弹窗：通用 `#modal`，里面塞各种表单（添加学生、改配额、重置密码、添加白名单等）。
- 公共逻辑：与学生端高度重叠的 `api()`、`fmt*`、`escapeHtml`、`providerLabel`。

### 2.3 部署链路

- `src/app.js` 用 `express.static(src/public)` 直接吐 HTML。
- `scripts/deploy-cloudbase.sh` 把整个 `src/` 拷到临时目录后用 `tcb fn deploy` 推到 CloudBase 云函数。
- 也就是说，**前端产物只要落到 `src/public/` 就能被托管**，重构不需要改后端运行时。

## 3. 技术选型

| 维度 | 选择 | 理由 |
|---|---|---|
| 构建工具 | **Vite 5** | 多页面（MPA）原生支持；dev server 启动毫秒级；零 babel 折腾。 |
| 框架 | **Vue 3 + Composition API**（SFC） | 模板就是 HTML，团队上手成本低；SFC 的 `<template>/<script setup>/<style scoped>` 切分天然契合"每个组件一个小文件"的目标；学生维护者读得懂。 |
| 路由 | **Vue Router（hash 模式）** | 不需要服务端 rewrite，CloudBase 现有静态托管即可工作；现有视图切换本就不深链。 |
| 状态 | **Pinia** | 替代当前散落在 module-level 全局变量（`students`、`whitelist`、`profile` 等）的写法。 |
| 网络 | **原生 fetch + 一层薄封装** | 沿用 `api()` 的语义，不引入 axios；TS 接口定义放在 `shared/api/`. |
| 样式 | **保留现有 CSS 变量 + scoped CSS** | 设计风格（和风调色板 + Noto Serif JP）是项目身份的一部分，**不引入 Tailwind/UI 库**，把现有 token 抽到 `shared/styles/tokens.css`。 |
| 语言 | **TypeScript**（建议） | 长期维护项目，`User`、`UsageRecord`、`Upstream` 这些字段反复出现，类型定义能挡住一大类回归 bug。若团队抗拒可降级为 JSDoc。 |

不引入：UI 库（Element/Ant Design）、CSS 框架（Tailwind/UnoCSS）、测试框架、ESLint。保持配置最小化，避免又走上"装一堆工具最后无人维护"的老路。

## 4. 目标目录结构

```
api-share/
├── frontend/                       # 新增：前端源码与构建配置
│   ├── package.json
│   ├── vite.config.ts              # 多页面入口 + 输出到 ../src/public
│   ├── tsconfig.json
│   ├── index.html                  # 学生端入口模板
│   ├── admin.html                  # 管理端入口模板
│   └── src/
│       ├── shared/                 # 双端共用
│       │   ├── api/
│       │   │   ├── client.ts       # getMountPath + fetch 封装
│       │   │   ├── auth.ts
│       │   │   ├── usage.ts
│       │   │   └── types.ts        # User / UsageRecord / Upstream 等
│       │   ├── format.ts           # fmtTokens / fmtCny / fmtDate / providerLabel
│       │   ├── styles/
│       │   │   ├── tokens.css      # 所有 CSS 变量
│       │   │   ├── base.css        # 复位 + body
│       │   │   └── controls.css    # .btn / .input / .msg / .field
│       │   └── components/
│       │       ├── Modal.vue
│       │       ├── TopBar.vue
│       │       └── EmptyState.vue
│       ├── student/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── router.ts
│       │   ├── stores/
│       │   │   ├── auth.ts
│       │   │   └── dashboard.ts
│       │   ├── views/
│       │   │   ├── Landing.vue
│       │   │   ├── Overview.vue
│       │   │   ├── Guide.vue
│       │   │   ├── Usage.vue
│       │   │   └── Models.vue
│       │   └── components/
│       │       ├── AuthModal.vue
│       │       ├── KeyModal.vue
│       │       ├── ResetPasswordForm.vue
│       │       ├── ModelGroupList.vue
│       │       └── UsageFilters.vue
│       └── admin/
│           ├── main.ts
│           ├── App.vue
│           ├── router.ts
│           ├── stores/
│           │   └── auth.ts
│           ├── views/
│           │   ├── Login.vue
│           │   ├── Students.vue
│           │   ├── Whitelist.vue
│           │   └── UsageLog.vue
│           └── components/
│               ├── Sidebar.vue
│               ├── StudentTable.vue
│               ├── QuotaEditor.vue
│               ├── ResetPasswordDialog.vue
│               └── WhitelistTable.vue
├── src/                            # 后端不变
│   └── public/                     # ← Vite 构建输出目标（git ignore 产物）
└── ...
```

## 5. 构建与部署改造

### 5.1 Vite 配置要点

- `build.outDir = '../src/public'`、`build.emptyOutDir = true`，构建直接落到 Express 静态目录。
- `rollupOptions.input` 同时声明 `index.html` 和 `admin.html`，输出 `assets/*.[hash].js/css`。
- `server.proxy` 把 `/api`、`/v1`、`/admin` 转到 `http://localhost:3000`，前端 dev server（:5173）和后端共存。
- `base: './'` 保证 `getMountPath()` 在子路径挂载（如 CloudBase 网关下的 `/api-share`）下仍然正确。

### 5.2 根 `package.json` 脚本

```jsonc
{
  "scripts": {
    "start": "node src/app.js",
    "dev:frontend": "npm --prefix frontend run dev",
    "build:frontend": "npm --prefix frontend run build",
    "deploy": "npm run build:frontend && bash scripts/deploy-cloudbase.sh"
  }
}
```

本地开发流程：
1. 终端 A：`npm start`（后端）
2. 终端 B：`npm run dev:frontend`（前端 hot reload，访问 http://localhost:5173 / 或 /admin.html）

### 5.3 部署脚本调整

`scripts/deploy-cloudbase.sh` 在 `cp -R src/.` 之前增加：
- 校验 `src/public/index.html` 是否存在且非源模板（防止有人忘了 `npm run build`）。
- 或者直接在脚本头部 `npm run build:frontend`（和 `npm run deploy` 二选一，避免重复构建）。

GitHub Actions 工作流补充：
- Setup Node 步骤里加 `cd frontend && npm ci`。
- 在 `tcb fn deploy` 之前跑一步 `npm run build:frontend`。

### 5.4 Git ignore

```
# 前端构建产物（由 Vite 生成）
src/public/index.html
src/public/admin.html
src/public/assets/
frontend/node_modules/
frontend/dist/
```

> 注意：当前 `src/public/` 下的两个 HTML 是真正的源码，迁移完成前不能 ignore。下面分阶段方案里有详细的过渡步骤。

## 6. 分阶段迁移

每一阶段都要保证 `npm start` 可用、线上可部署、视觉/交互无回归。

### 阶段 0：脚手架（半天）

- [ ] 创建 `frontend/`，初始化 Vite + Vue 3 + TS + Pinia + Vue Router。
- [ ] 写 `vite.config.ts`，配 MPA 入口和 dev proxy。
- [ ] 在 `frontend/index.html` 和 `frontend/admin.html` 里只放壳子（挂 `<div id="app">` 和字体 `<link>`）。
- [ ] 跑通 `npm run dev:frontend` 能打开两个空白页。
- [ ] **此阶段不动 `src/public/`**，构建输出先写到 `frontend/dist/` 验证。

### 阶段 1：抽公共层（半天）

- [ ] 把 CSS 变量、`* { box-sizing }`、`.btn / .input / .msg / .field / .hidden` 等迁到 `shared/styles/`。
- [ ] 把 `getMountPath`、`api()`、`escapeHtml`、`fmt*`、`providerLabel` 迁到 `shared/`，加 TS 类型。
- [ ] 写 `Modal.vue`、`TopBar.vue` 这种两端共用的小组件。
- [ ] 在 `frontend/admin.html` 里临时挂一个 demo 页验证样式 token 与原 admin 像素一致（截图对照）。

### 阶段 2：迁移管理端（1–2 天）

理由：admin 体量小（3 tab，~290 行 JS），先拿它当试金石。

- [ ] `Login.vue` + `auth` store。
- [ ] `Sidebar.vue` + `App.vue` 路由壳子。
- [ ] `Students.vue`：表格 + 添加学生 + 改配额（`QuotaEditor.vue`）+ 重置密码。
- [ ] `Whitelist.vue`。
- [ ] `UsageLog.vue`。
- [ ] 把构建输出切换到 `../src/public/`，删除旧 `src/public/admin.html`。
- [ ] 端到端验证：登录、加学生、改配额、删白名单、查日志，全部对照原版操作一遍。

### 阶段 3：迁移学生端（2–3 天）

- [ ] `Landing.vue`：顶栏 + 公开模型列表（不需要登录态）。
- [ ] `AuthModal.vue` + `ResetPasswordForm.vue` + `KeyModal.vue`。
- [ ] `Overview.vue`：profile 卡片 + 配额进度条。
- [ ] `Guide.vue`：接入指导（OpenAI / Anthropic 双协议示例）。
- [ ] `Usage.vue` + `UsageFilters.vue`：日志表 + provider/model 过滤。
- [ ] `Models.vue` + `ModelGroupList.vue`：分组渲染、展开/收起。
- [ ] 删除旧 `src/public/index.html`。
- [ ] 端到端验证：注册、登录、看 key、刷日志、按 provider 过滤、模型分组展开、重置密码、注销。

### 阶段 4：部署链路收口（半天）

- [ ] 更新 `scripts/deploy-cloudbase.sh`：构建校验或自动构建。
- [ ] 更新 GitHub Actions workflow。
- [ ] 把构建产物路径加进 `.gitignore`。
- [ ] 在 `dev` 环境完整跑一次 `npm run deploy` 验证。

### 阶段 5：文档与收尾（半天）

- [ ] `CLAUDE.md`：更新"Architecture"和"Commands"小节，说明 `frontend/` 的存在和 dev/build 流程。
- [ ] `DEVELOPMENT.md`：补本地双端启动步骤。
- [ ] `CONTRIBUTING.md`：补前端目录约定。
- [ ] `frontend/README.md`：组件分布、添加新页面的范例。
- [ ] 把"如何加一个新管理 tab"写成 30 行的 howto，便于学生贡献者照抄。

总计估时：**约 5–7 个工作日**（单人，含调试和文档）。

## 7. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| 视觉走样 | 项目的和风设计是核心识别度，重构期间 padding/font 容易偏 | 把所有 CSS 变量整体搬迁，不重写；每个页面迁移完用截图对比原版 |
| 多页面挂载路径出错 | CloudBase 网关下子路径访问出现 404 | `vite.config.ts` 用 `base: './'`，所有内部跳转走 `getMountPath()`；上线前在子路径 dev 环境验证 |
| 部署体积变大 | 云函数包从纯文本 70 KB 增至 ~300 KB | 影响极小（云函数包大小限制远高于此），可接受；后续若需要可启用 brotli |
| 维护成本反升 | 引入 Vite/Vue/TS 后，新人贡献门槛上升 | 不引入 UI 库、不引入 ESLint/测试，配置文件保持最小；写一份 30 行的 "加一个 tab" 速查 |
| TypeScript 阻力 | 学生贡献者不熟 TS | 类型定义集中在 `shared/api/types.ts`，组件可以只用极少 TS 标注；若实在不想要可降级为 JSDoc |
| AI Coding 期望落空 | 拆分后单文件确实小，但跨文件改动会带来 N+1 个文件读取 | 在 `frontend/README.md` 里把组件依赖图画出来；约定：跨视图改动写在 conversation 里，不要让 AI "扫一遍 frontend/" |

## 8. 验收标准

重构完成后，必须满足：

1. `npm start` + `npm run dev:frontend` 双端开发体验流畅，前端有 HMR。
2. `npm run deploy` 一键产出与原版功能 1:1 等价的部署产物。
3. 现有所有用户操作（学生注册/登录/重置/查 key/查日志/查模型；管理员加学生/改配额/管白名单/查日志）行为不变。
4. 视觉对比无可见回归（关键页面在 1280×800 下截图对照）。
5. 迭代一个常见诉求（例：给学生表加一列"上次活跃时间"）只需修改 ≤ 3 个文件，每个 < 200 行。
6. CLAUDE.md / DEVELOPMENT.md / CONTRIBUTING.md 已更新。

## 9. 后续可选项（不在本次范围）

- 接入 [VueUse](https://vueuse.org/) 减少手写 hook。
- 把上游配置编辑能力从"线下手改 DB"提升为管理端可视化（与本次重构无关，但拆完之后做更顺手）。
- 引入 `vitest` 对 `shared/format.ts`、`shared/api/` 做最小单测。
- 把 Landing 页迁到独立的 `marketing/`（如果未来要做品牌站）。
- 国际化（i18n）：当前全中文硬编码，后续如要做英文需在 shared 层加 i18n 中间件。

---

**决策点**（开始动手前需要确认）：

1. 框架选型：Vue 3（推荐） vs React vs Svelte？
2. 是否使用 TypeScript？
3. 是否一次性把两端都迁完，还是先迁管理端跑一段时间再迁学生端？
4. 谁来负责 PR review，节奏如何（每阶段一个 PR vs 单 PR 整体合）？
