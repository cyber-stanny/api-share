# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LLM API proxy platform (大模型 API 中转平台) for students. Students register with whitelisted student IDs, receive an API Key, and proxy requests to upstream LLM providers (MiMo and Aliyun Token Plan). Supports OpenAI-compatible format (`/v1/chat/completions`) and Anthropic format (`/v1/messages`).

**Stack**: Node.js + Express + serverless-http + Tencent CloudBase (serverless cloud functions + document database) + Vue 3/Vite frontend in `frontend/`

## Commands

```bash
npm install
cp .env.example .env               # Copy and fill in env vars

# Backend only (port 3000):
npm start

# Frontend dev (port 5173, proxies /api and /v1 to localhost:3000):
npm run dev:frontend

# Build frontend (outputs to src/public/):
npm run build:frontend

# Full deploy (builds frontend then deploys via tcb CLI):
npm run deploy

# First deployment initialization scripts:
CLOUDBASE_ENV_ID=xxx node scripts/init-admin.js
CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js
```

Auto-deploys to CloudBase on push to `main` via GitHub Actions. The workflow installs root and `frontend/` dependencies from lockfiles, logs in with CloudBase secrets, then runs `npm run deploy`. The deploy script builds the Vite frontend, verifies `src/public/index.html`, `src/public/admin.html`, and `src/public/assets/`, stages `src/` plus root package files, and writes a temporary CloudBase config with environment variables.

## Architecture

Single Express app wrapped in `serverless-http` for CloudBase cloud function runtime. All routes live under one function named `api-share`.

### Frontend (`frontend/`)

Vue 3 SPA built with Vite 5. Two entry points:
- `frontend/index.html` → Student portal (route: `/`)
- `frontend/admin.html` → Admin dashboard dev entry; production is served at `/admin` and uses hash routes such as `#/login`

Shared code lives in `frontend/src/shared/`:
- `shared/api/client.ts` — `getMountPath()`, `api()`, `escapeHtml()`
- `shared/api/types.ts` — `User`, `UsageRecord`, `Upstream`, `ModelInfo` types
- `shared/format.ts` — `fmt()`, `fmtTokens()`, `fmtDate()`, `pct()`, `groupModelsByProvider()`
- `shared/styles/` — CSS tokens (`tokens.css`), base reset (`base.css`), controls (`controls.css`)
- `shared/components/` — `Modal.vue`, `TopBar.vue`, `EmptyState.vue`

Build outputs to `src/public/` (gitignored). `npm run deploy` runs `npm run build:frontend` before staging files.

### Request Flow

```
Client → Express app.js → middleware → route handler → upstream provider → response
```

### Authentication (Two Separate Systems)

- **JWT** (`middleware/auth.js` `studentAuth`, `middleware/adminAuth.js`): Used for management endpoints (`/api/auth/*`, `/api/admin/*`). Two roles: `student` and `admin`.
- **API Key** (`middleware/auth.js` `apiKeyAuth`): Used for proxy endpoints (`/v1/*`). The raw key is SHA-256 hashed and looked up in the `users` collection. Students never see their key hash — only the plaintext once at registration.

### Proxy Endpoints (`routes/proxy.js`)

The core of the system. Each request goes through: auth → quota check → rate limit → concurrent limit → upstream lookup → forward → record usage → accumulate token count.

- `POST /v1/chat/completions` — OpenAI format, forwards to any `protocol: 'openai'` upstream
- `POST /v1/messages` — Anthropic format, forwards to `protocol: 'anthropic'` upstreams only
- Streaming: uses `Readable.fromWeb()` + `pipe()` for SSE pass-through. OpenAI streaming captures usage via `stream_options: { include_usage: true }`. Anthropic streaming parses `message_start` and `message_delta` events for token counts.

### Token-Based Quota (`services/quota.js`)

Uses a `token_counters` collection for fast lookups instead of summing usage_records. Each student has a counter document with separate MiMo and Aliyun token fields, incremented atomically via `_.inc()`. Deprecated provider fields may remain in historical documents but are not written by new requests. Counters auto-reset when day/week boundaries are crossed.

### Upstream Routing (`services/upstream.js`)

Cached (1 min TTL). Each upstream record has a `protocol` field (`openai` or `anthropic`). `findUpstream(model, protocol)` selects the highest-priority upstream supporting both the requested model and protocol, randomizing among peers at the same priority level.

### Database Collections (CloudBase Document DB)

| Collection | Purpose |
|---|---|
| `users` | Student accounts. `quota: { dailyTokenLimit, weeklyTokenLimit }` |
| `admins` | Admin accounts |
| `whitelist` | Allowed student IDs for self-registration |
| `upstreams` | Provider configs. Has `protocol` field (`openai`/`anthropic`) |
| `usage_records` | Per-request logs with token counts and billing provider |
| `token_counters` | Aggregated daily/weekly MiMo and Aliyun tokens |

### Services Layer

- `services/quota.js` — Token quota check and accumulation
- `services/billing.js` — Provider token billing units
- `services/rateLimit.js` — In-memory per-student rate limit (60 req/min) + global concurrent limit (100)
- `services/upstream.js` — Cached upstream provider lookup
- `services/usage.js` — Async usage record write (fire-and-forget)

### Init Scripts (`scripts/`)

- `init-admin.js` — Creates default admin account
- `seed-upstreams.js` — Seeds upstream providers (MiMo + Aliyun with both protocols)
- `reconcile-upstreams.js` — Previews or applies Aliyun enablement and retired provider disablement

## Key Conventions

- API Key format: `sk-` prefix + 48 hex chars. Stored as SHA-256 hash, plaintext shown only at registration.
- Admin dashboard: Vue 3 SPA at `frontend/admin.html`, served from `src/public/admin.html` after build.
- No test framework installed. No linter configured.
- CloudBase document database is MongoDB-like — no JOINs, use `db.command` for queries (imported as `_` from `db.js`).
- Rate limiting is in-memory (Map + setInterval cleanup). Known limitation in multi-instance serverless — acceptable for current scale.
