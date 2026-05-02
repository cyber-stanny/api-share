# 视觉优化阶段性计划

> **目的**：把当前学生端 + 管理端的视觉问题拆成 5 个相对独立的执行阶段。每个阶段可以单独 PR、单独验收、互不阻塞（除了 P0 是其他阶段的基础）。
>
> **使用方式**：执行 AI 按阶段顺序认领。每个阶段开头都列出「上下文 / 目标 / 改动清单 / 验收标准」，可冷启动直接干活。
>
> **技术栈提醒**：Vue 3 + Vite + TypeScript，shared tokens 在 `frontend/src/shared/styles/`，学生端 `frontend/src/student/`，管理端 `frontend/src/admin/`，公用组件 `frontend/src/shared/components/`（已有 `Modal.vue` / `TopBar.vue` / `EmptyState.vue`）。

---

## P0 · 设计基础（Foundation）

> **必须最先完成**。后续阶段都依赖这里扩展的 token 和共享组件。

**上下文**
- 当前 `tokens.css` 只有 17 行，只定义了 primary / secondary / bg / shell / surface / text / muted 等基础色。
- Overview / Students 页面里散落着 `#5f7ea8`、`#8b6a9b`、`#4D6BFE`、`#3D5BEE` 等硬编码颜色，没有语义。
- 项目还缺统一的 toast、confirm、skeleton 组件；空状态有 `EmptyState.vue` 但使用率低。

**目标**
- 把"颜色 / 间距 / 阴影 / 圆角 / 字号"从代码里抽到 token；让后续阶段只引用 token，不再自定义魔法值。
- 补齐 toast / confirm / skeleton 三个共享组件，替代裸 `alert()` 和无反馈交互。

**改动清单**
1. **扩展 `frontend/src/shared/styles/tokens.css`**
   - Provider 语义色：`--mimo`、`--mimo-soft`；`--deepseek`、`--deepseek-soft`；`--minimax`、`--minimax-soft`（在和风调色下挑 3 个互不冲突的 hue，避免现在的蓝 / 紫 / 深蓝乱入）。
   - 状态色：`--success`、`--warning`、`--danger`、`--info`，每个都配 `-soft` 背景版本。
   - 角色 accent：`--accent-student`（= primary sage）、`--accent-admin`（= secondary terracotta），供 P3 差异化使用。
   - Spacing：`--space-1` ~ `--space-8`（4/8/12/16/24/32/48/64）。
   - Radius：`--radius-sm/md/lg/pill`（6/10/16/999）。
   - Shadow：`--shadow-1/2/3`（1px ambient / 浮起卡片 / 弹窗）。
   - Type scale：`--text-xs/sm/base/lg/xl/2xl/3xl/display`（12/13/15/17/20/24/32/48）。
   - Z-index：`--z-sidebar/modal/toast/tooltip`。
2. **新增 `frontend/src/shared/components/Toast.vue` + `frontend/src/shared/composables/useToast.ts`**
   - API：`useToast().success(msg)` / `.error(msg)` / `.info(msg)`，全局 mount 在 `App.vue` 顶层。
   - 自动消失（默认 2.5s），同时最多堆 3 条，旧的下移。
   - 不引入新依赖，纯 Vue 实现。
3. **新增 `frontend/src/shared/components/ConfirmDialog.vue` + `useConfirm()` composable**
   - 替代浏览器 `confirm()`，支持「危险操作」红色按钮变体。
   - 全局挂一个，通过 composable 调用，返回 Promise<boolean>。
4. **新增 `frontend/src/shared/components/Skeleton.vue`**
   - 简单的 shimmer 占位块，接受 `width` / `height` / `radius` 三个 prop。
5. **更新 `frontend/src/shared/styles/controls.css`**
   - 按钮新增 size 变体：`.btn.sm` / `.btn.lg`；intent 变体保持 `primary/secondary/danger`，新增 `ghost`（透明底）。
   - 输入框 focus ring 用 `--primary` 的 alpha 色，而不是只换 border。

**验收标准**
- [ ] 全仓 grep 不再出现 `#5f7ea8`、`#8b6a9b`、`#4D6BFE`、`#3D5BEE` 这些硬编码颜色（应被 provider token 替代）。
- [ ] `useToast`、`useConfirm` 可以在任意 view 里 import 并立即工作。
- [ ] `npm run build:frontend` 通过，两个 entry 都能正常打包。
- [ ] 视觉回归：把 Overview / Students 页打开看一眼，颜色应该和原来基本接近（这一阶段不改样式，只搬到 token）。

---

## P1 · 关键信息仪式感（Key Moments）

**上下文**
- API Key 是学生**唯一一次**能看到的核心资产，目前 `KeyModal.vue` 只把它放在一个灰色等宽框里，「我已保存」和「复制」两个按钮等权。
- `Guide.vue` 把 Claude / OpenAI 两段示例代码裸排在两个 block 里，没有语法高亮、没有 tab 切换、没有复制按钮。
- 复制 / 保存 / 删除等操作目前**完全没有反馈**，用户不确定是否成功。

**目标**
- 让"领 Key → 用 Key"这条主路径的每个节点都有视觉重量和反馈。

**改动清单**
1. **重构 `frontend/src/student/components/KeyModal.vue`**
   - Hero 式呈现：Key 用 `--text-xl` 等宽字号 + 一次性强调底色 + 复制图标按钮内嵌右侧。
   - 顶部加 `--warning-soft` 横幅："此 Key 仅显示一次，请立即保存"。
   - 「我已保存」用 `.btn.primary`，「复制」用 `.btn.ghost` + 图标，建立明确主次。
   - 复制成功调用 `useToast().success('已复制到剪贴板')`，按钮文字短暂变「已复制 ✓」。
2. **重构 `frontend/src/student/views/Guide.vue`**
   - 顶部加 tab 切换：`Anthropic 协议` / `OpenAI 协议`，默认选中 Anthropic（项目主推）。
   - 代码块用 [shiki](https://shiki.style/) 或 [highlight.js](https://highlightjs.org/) 做语法高亮（选 shiki，体积更可控、有内置 token 主题）。
   - 每个代码块右上角加复制按钮，复制后 toast 反馈。
   - 协议块下方加一句"⏱ 流式 / 非流式都支持"等可扫读的小贴士（取自 README 或 routes/proxy.js 注释）。
3. **批量替换 `confirm()` / 静默操作的反馈**
   - `frontend/src/admin/views/Whitelist.vue` 删除走 `useConfirm()`。
   - `frontend/src/admin/views/Students.vue` 重置密码 / 删除学生 走 `useConfirm()`。
   - `QuotaEditor.vue` 保存成功 toast。
   - 所有 form 提交成功都补 toast。

**验收标准**
- [ ] 学生注册流程走一遍，弹出的 KeyModal 视觉上明显比原来更"重"，复制按钮有反馈。
- [ ] Guide 页面切换两个 tab，代码有高亮和复制按钮。
- [ ] 全仓 grep `confirm(` 应该只剩 P0 的 `useConfirm` 自身实现。

---

## P2 · 数据密度重构（Information Density）

**上下文**
- `admin/views/Students.vue` 每行学生塞 9 条 mini bar（MiMo 日 / 周，DeepSeek 日 / 周，MiniMax 日 / 周 + 其他），加上"日/周"小字标签，扫读极困难。
- `student/views/Overview.vue` 7 张配额卡片 + token-meter 用 2px 粗边框 + 多个未被 token 化的颜色。
- `admin/views/UsageLog.vue` 8 列宽表，无空状态、无 loading、无分页。

**目标**
- 把"展示所有数字"改成"先扫一眼大势 → 想看细节再点开"。
- 利用 P0 引入的 provider token 让数据色彩有规则。

**改动清单**
1. **重构 `admin/views/Students.vue` 表格行**
   - 把 9 条 bar 折叠为 3 个 provider chip：每个 chip 显示 provider 名 + 单条 stacked bar（日 / 周占比堆叠）+ 百分比文字。
   - 行末加 `详情` 按钮，点开侧滑抽屉（新增 `frontend/src/admin/components/StudentDetailDrawer.vue`），抽屉里再展开完整的日 / 周双 bar、近 7 天用量趋势 mini chart。
   - 表头支持按"今日 token 用量"排序，方便定位高消耗学生。
2. **重构 `student/views/Overview.vue`**
   - 7 张卡 → 收成 3 张 provider 卡（MiMo / DeepSeek / MiniMax），每张卡内用 2 个细进度条（日 / 周）共用 provider token 配色。
   - 去掉 2px 粗边框，改用 1px `--border` + 顶部 4px provider accent stripe。
   - 「我的 API Key 信息」「快速开始」横向分栏改为竖向单栏，避免在小屏挤压。
3. **重构 `admin/views/UsageLog.vue`**
   - 加客户端分页（每页 20 条）或 `加载更多` 按钮。
   - 加按学号 / 按 provider / 按状态的 filter chip 组（替换现在单个文本输入）。
   - 表格首次加载用 `Skeleton.vue` 占位 5 行。
   - 空数据用 `EmptyState.vue`，文案要具体：「最近 3 天没有调用记录」。
4. **统一表格基类**
   - 新增 `frontend/src/shared/styles/table.css`：定义 `.data-table`，包含 zebra row、hover 高亮、sticky header、compact / regular 两种 density。
   - 三个表格（Students / UsageLog / Whitelist）都迁移过去。

**验收标准**
- [ ] Students 表格每行视觉元素从 ~12 个降到 ≤6 个。
- [ ] Overview 页面打开后第一屏能看到「今天用了多少 / 还剩多少」的核心信息，不需要解读小字。
- [ ] UsageLog 在没有数据时显示 EmptyState，加载时显示 skeleton。
- [ ] 三个表格 hover / sticky header 行为一致。

---

## P3 · 角色差异化（Student vs Admin）

**上下文**
- 两端 Sidebar 完全相同的视觉，多角色用户切换上下文时容易混淆。
- 学生端登录是 modal（`AuthModal.vue`），管理端登录在 P0 重构前是页面，目前混用 `LoginModal.vue` + `views/Login.vue`，行为不一致。
- 没有任何视觉提示告诉用户"我现在在管理端"。

**目标**
- 用 P0 准备的 `--accent-student` / `--accent-admin` 让两端一眼可辨，但保持骨架一致（用户学习成本低）。

**改动清单**
1. **管理端 accent 替换**
   - `admin/components/Sidebar.vue` 的 brand logo 块、active 状态、hover 强调色都替换成 `--accent-admin`（terracotta 系）。
   - 顶部 brand 旁加一个 `ADMIN` chip（小 pill，`--accent-admin-soft` 底色）。
   - 学生端保持 `--accent-student`（sage 系），不动。
2. **登录入口对齐**
   - 删掉 `admin/views/Login.vue`（如果仍在用），统一走 `LoginModal.vue` 弹窗模式，和学生端 AuthModal 体验一致。
   - 路由层判断未登录时直接弹 modal，不跳转独立页面。
   - 检查 `admin/router.ts` 的 guard 逻辑。
3. **管理端页面顶部加 context bar**
   - 新增 `admin/components/AdminTopBar.vue`：左侧显示当前 admin 用户名，右侧放主操作按钮（Students 页放「+ 新增学生」，Whitelist 页放「+ 添加白名单」），把这些 CTA 从页内挪到顶部 bar，让页面主体专注内容。
4. **favicon / document title 区分**
   - 学生端 title `API Share · 控制台`，管理端 title `API Share · 管理`。
   - 如果有条件，准备两个 favicon（例如 sage / terracotta 圆点），在 `frontend/index.html` 和 `frontend/admin.html` 分别引用。

**验收标准**
- [ ] 同时打开学生端和管理端两个 tab，浏览器标签栏 favicon + title 即可分辨。
- [ ] 管理端 sidebar 颜色和学生端形成鲜明对比，但布局完全一致。
- [ ] 管理端不再有"独立登录页"，统一弹窗。

---

## P4 · 落地页与品牌强化（Brand & Landing）

**上下文**
- `student/views/Landing.vue` 是用户第一眼看到的页面，目前是通用的 hero + model strip 模板，缺乏"专属学生通道"的人格。
- `student/views/Models.vue` 像占位内容：白色大块 + 等宽字号 + 交替顶边色。
- 字体系统里的 Noto Serif JP / JetBrains Mono / Noto Sans JP 三套，目前 Serif 几乎只在大标题闪一下。

**目标**
- 让 Landing 有故事感和品牌色彩；让 Models 像产品橱窗，不像 admin 列表。

**改动清单**
1. **Landing.vue 重设计**
   - Hero 区：保留中央 Serif 标题，但在标题左右加和风装饰元素（细线 / 印章 / 几何点阵），用 `--accent-student` 极淡的色块铺底。
   - 在 hero 下方加 3 个 feature highlight 横排（「OpenAI 兼容」「Anthropic 兼容」「按学号配额」），每个用图标 + 短句，用 provider token 三色区分。
   - Model carousel 升级为 3 列卡片网格，每张卡显示 provider logo / 模型数 / 协议支持。
   - 底部加一个极简的"如何开始"3 步流程图，引导到 Guide。
2. **Models.vue 升级**
   - 按 provider 分组显示，每组顶部用 provider accent stripe + 大字号 provider 名。
   - 模型卡变成"信息卡"：左侧模型名 + 协议 chip，右侧显示 context window / 价格（如可得）等元信息。
   - 加搜索框（在 sidebar 已有的 nav 下方），支持按模型名 / provider 过滤。
3. **字体层级激活**
   - 所有 Overview / Students 卡片中的"核心数字"（quota 数字、用量数字）改用 Serif + tabular-nums，让 Serif 真正承担识别任务。
   - 全局把 `letter-spacing: .08em` 的 10px 小标签升到 `--text-sm` (13px)，提升可读性。
4. **404 / 错误页**
   - 新增 `frontend/src/student/views/NotFound.vue`，用品牌字体 + 一个"返回控制台"按钮，避免裸白屏。

**验收标准**
- [ ] Landing 滚动一屏内可以看到 hero / 3 feature / 模型预览三个层次。
- [ ] Models 页面每个 provider 区块视觉上独立，能扫到模型清单。
- [ ] Overview 页大数字明显用了 Serif（视觉上和小字 Sans 形成对比）。
- [ ] 直接访问 `/some-bad-route` 显示自定义 404。

---

## 整体执行顺序与依赖

```
P0 (必做，基础)
 ├─ P1 (Key 仪式感)        ← 依赖 P0 的 toast/confirm
 ├─ P2 (数据密度)          ← 依赖 P0 的 provider token + skeleton
 ├─ P3 (角色差异化)        ← 依赖 P0 的 accent token
 └─ P4 (品牌 & Landing)    ← 依赖 P0 的 type scale + provider token
```

P1 / P2 / P3 / P4 之间**没有相互依赖**，P0 完成后可以并行（建议串行做，方便代码审查）。

---

## 通用约束（每个阶段都要遵守）

- 不引入除 `shiki`（P1 代码高亮）外的新运行时依赖。
- 不动后端 API。所有改动在 `frontend/` 内。
- 改完每个阶段都要跑 `npm run build:frontend` 确认两个 entry 都能编译。
- 不写新的 `*.md` 文档，除非用户明确要求。
- Commit 信息按现有风格：`refactor:` / `redesign:` / `fix:` 前缀。

---

## 当前已识别但本计划不覆盖的事项

- 后端 API 性能 / 可观测性优化。
- 移动端响应式（当前都是 desktop 优先，移动端体验另作专题）。
- 国际化（目前全中文 hardcode）。
- 单元 / E2E 测试（仓库目前无测试框架）。

如需把上面任一项纳入，请单独开一个计划文档。
