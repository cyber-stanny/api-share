# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LLM API proxy platform (大模型 API 中转平台) for students. Students register with whitelisted student IDs, receive an API Key, and proxy requests to upstream LLM providers (Silicon Flow, Mimo). Supports OpenAI-compatible format (`/v1/chat/completions`) and Anthropic format (`/v1/messages`).

**Stack**: Node.js + Express + serverless-http + Tencent CloudBase (serverless cloud functions + document database)

## Commands

```bash
npm install
npm start                          # Local dev: http://localhost:3000
cp .env.example .env               # Copy and fill in env vars

# First deployment initialization scripts:
CLOUDBASE_ENV_ID=xxx node scripts/init-admin.js
CLOUDBASE_ENV_ID=xxx node scripts/seed-upstreams.js

npm run deploy                     # Manual deploy via tcb CLI
```

Auto-deploys to CloudBase on push to `main` via GitHub Actions. The deploy workflow uses `sed` to replace `{{PLACEHOLDER}}` tokens in `cloudbaserc.json` with GitHub Secrets.

## Architecture

Single Express app wrapped in `serverless-http` for CloudBase cloud function runtime. All routes live under one function named `api-share`.

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
- `POST /v1/messages` — Anthropic format, forwards to `protocol: 'anthropic'` upstreams only (currently just Mimo)
- Streaming: uses `Readable.fromWeb()` + `pipe()` for SSE pass-through. OpenAI streaming captures usage via `stream_options: { include_usage: true }`. Anthropic streaming parses `message_start` and `message_delta` events for token counts.

### Token-Based Quota (`services/quota.js`)

Uses a `token_counters` collection for fast lookups instead of summing usage_records. Each student has a counter document with `dailyTokens` and `weeklyTokens` fields, incremented atomically via `_.inc()`. Counters auto-reset when day/week boundaries are crossed.

### Upstream Routing (`services/upstream.js`)

Cached (1 min TTL). Each upstream record has a `protocol` field (`openai` or `anthropic`). `findUpstream(model, protocol)` selects the highest-priority upstream supporting both the requested model and protocol, randomizing among peers at the same priority level.

### Database Collections (CloudBase Document DB)

| Collection | Purpose |
|---|---|
| `users` | Student accounts. `quota: { dailyTokenLimit, weeklyTokenLimit }` |
| `admins` | Admin accounts |
| `whitelist` | Allowed student IDs for self-registration |
| `upstreams` | Provider configs. Has `protocol` field (`openai`/`anthropic`) |
| `usage_records` | Per-request logs with token counts |
| `token_counters` | Aggregated daily/weekly token totals per student |

### Services Layer

- `services/quota.js` — Token quota check and accumulation
- `services/rateLimit.js` — In-memory per-student rate limit (60 req/min) + global concurrent limit (100)
- `services/upstream.js` — Cached upstream provider lookup
- `services/usage.js` — Async usage record write (fire-and-forget)

### Init Scripts (`scripts/`)

- `init-admin.js` — Creates default admin account
- `seed-upstreams.js` — Seeds upstream providers (Silicon Flow + Mimo with both protocols)

## Key Conventions

- API Key format: `sk-` prefix + 48 hex chars. Stored as SHA-256 hash, plaintext shown only at registration.
- Admin dashboard: single-file SPA at `src/public/admin.html`, served at `GET /admin`.
- No test framework installed. No linter configured.
- CloudBase document database is MongoDB-like — no JOINs, use `db.command` for queries (imported as `_` from `db.js`).
- Rate limiting is in-memory (Map + setInterval cleanup). Known limitation in multi-instance serverless — acceptable for current scale.
