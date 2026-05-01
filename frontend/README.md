# Frontend

Vue 3 SPA built with Vite 5 + TypeScript + Pinia + Vue Router.

## 目录结构

```
frontend/
├── index.html              # 学生端入口
├── admin.html             # 管理端入口
├── src/
│   ├── shared/            # 两端共用
│   │   ├── api/          # API 封装 (client.ts) + 类型定义 (types.ts)
│   │   ├── format.ts     # 格式化函数
│   │   ├── styles/       # CSS tokens, base, controls
│   │   └── components/    # Modal, TopBar, EmptyState
│   ├── student/           # 学生端
│   │   ├── views/        # Landing, Overview, Guide, Usage, Models
│   │   ├── components/    # AuthModal, KeyModal, ModelGroupList
│   │   ├── stores/       # auth, dashboard
│   │   ├── router.ts
│   │   └── App.vue
│   └── admin/            # 管理端
│       ├── views/        # Login, Students, Whitelist, UsageLog
│       ├── components/    # Sidebar, QuotaEditor
│       ├── stores/       # auth
│       ├── router.ts
│       └── App.vue
```

## 开发

```bash
# 安装依赖
npm install --prefix frontend

# 后端运行
npm start

# 前端热重载开发
npm run dev:frontend
```

前端开发服务器会自动代理 `/api`, `/v1`, `/admin` 到 `localhost:3000`。

## 构建

```bash
npm run build:frontend
```

构建产物输出到 `src/public/`，会被 Express 直接托管。

## 添加新页面

1. 在 `views/` 下创建 `.vue` 文件
2. 在 `router.ts` 中添加路由
3. 组件放在 `components/`

例：在管理端添加新的 tab 页面 `Statistics.vue`

```typescript
// admin/router.ts
import Statistics from './views/Statistics.vue'
// 添加路由: { path: '/stats', component: Statistics }
```

## API 封装

`@shared/api/client.ts` 提供：

- `getMountPath()` — 获取子路径前缀（适配 CloudBase 网关）
- `api<T>(path, opts)` — fetch 封装，自动处理 JSON
- `escapeHtml(str)` — XSS 防护

类型定义在 `@shared/api/types.ts`：`User`, `UsageRecord`, `Upstream`, `ModelInfo` 等。
