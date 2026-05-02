# Refactor Code Review

## Scope

- Base refactor commit: `9f4b7b8` (`refactor: migrate frontend to Vite/Vue SPA`)
- Review start time: `2026-05-01 12:12:13 EDT`
- Goal: run the refactored project, validate student/admin flows, and record every confirmed regression plus its fix.

## Findings

### 1. Admin dev page blank under Vite

- Status: fixed
- Severity: medium
- Found during: browser validation of `http://localhost:5177/admin.html`
- Symptom:
  - `admin.html` rendered as a blank page in Vite dev mode.
  - HAR showed the page HTML came from the backend build output instead of Vite source serving.
  - The browser then requested hashed production assets like `/assets/admin-bOS8jy_a.js`, which do not exist in dev mode, producing `404`.
- Root cause:
  - `frontend/vite.config.ts` proxied `/admin` to `http://localhost:3000`.
  - That proxy also matched `/admin.html`, so Vite never served the admin entry page itself.
- Fix:
  - Removed the `/admin` proxy entry from `frontend/vite.config.ts`.
- Verification:
  - Re-verified after restarting the Vite dev server.
  - `http://localhost:5177/admin.html` now renders the admin login screen correctly.

### 2. Protected frontend requests dropped auth tokens

- Status: fixed
- Severity: high
- Found during: code review of the refactored frontend after validating admin login API
- Symptom:
  - Admin and student login could store tokens in `localStorage`, but subsequent protected page requests did not send `Authorization`.
  - Affected admin pages included students, whitelist, and usage.
  - Affected student pages included profile, models, usage, and key regeneration.
- Root cause:
  - `frontend/src/shared/api/client.ts` only sent a bearer token when every caller passed `token` explicitly.
  - The refactored page/store code mostly called `api('/api/...')` without passing tokens.
- Fix:
  - Added path-based token resolution in `frontend/src/shared/api/client.ts`.
  - `/api/admin/*` now auto-loads `adminToken` except for `/api/admin/login`.
  - protected `/api/auth/*` routes now auto-load `studentToken`, excluding `login`, `register`, and `reset-password`.
- Verification:
  - Frontend production build passed after the change.
  - Call sites across admin/student protected pages now resolve authorization through the shared client instead of silently omitting it.

### 3. Student auth modal did not follow the requested mode after first open

- Status: fixed
- Severity: medium
- Found during: code review of landing page and auth modal state flow
- Symptom:
  - The landing page has separate “注册领取 Key” and “登录控制台” buttons.
  - `AuthModal` initialized `mode` from `initialMode` once, but never reacted to later prop changes.
  - After the first open, reopening from the other button could still show the previous tab.
- Root cause:
  - `frontend/src/student/components/AuthModal.vue` used `const mode = ref(props.initialMode || 'login')` without a watcher.
- Fix:
  - Added watchers for `initialMode` and `visible` so the modal resets to the requested mode on each open.
- Verification:
  - Frontend production build passed after the change.

### 4. Admin student management page missed promised actions

- Status: fixed
- Severity: high
- Found during: code review against the refactor plan and actual `Students.vue` implementation
- Symptom:
  - The page only listed students and allowed quota edits.
  - The “添加学生” button incorrectly routed to `/whitelist?add=true` instead of adding a student directly.
  - “重置密码” UI was missing even though the backend route existed.
- Root cause:
  - `frontend/src/admin/views/Students.vue` was implemented as a reduced subset of the planned workflow.
- Fix:
  - Replaced the misleading navigation with an in-page “添加学生” modal wired to `POST /api/admin/students`.
  - Added a “重置密码” action wired to `PUT /api/admin/students/:id/reset-password`.
  - Kept existing quota editing in place.
- Verification:
  - Frontend production build passed after the change.

### 5. Student dashboard navigation lost three core views

- Status: fixed
- Severity: high
- Found during: code review of `frontend/src/student/App.vue` against the refactor plan
- Symptom:
  - Student routes existed for `/overview`, `/guide`, `/usage`, and `/models`.
  - The top bar only rendered one button: “控制台”.
  - After login, users had no visible way to reach guide, usage, or models.
- Root cause:
  - `frontend/src/student/App.vue` did not recreate the original dashboard view switcher as route navigation.
- Fix:
  - Added explicit top bar navigation for `概览 / 接入指导 / 调用量 / 模型`.
- Verification:
  - Frontend production build passed after the change.

### 6. Student password reset workflow disappeared in the SPA

- Status: fixed
- Severity: high
- Found during: code review of `AuthModal.vue` against the plan and backend routes
- Symptom:
  - Backend still exposed `POST /api/auth/reset-password`.
  - The new student SPA had login and register only; no reset-password entry or form.
- Root cause:
  - The reset-password subflow mentioned in the migration plan was not migrated into the modal.
- Fix:
  - Added a reset mode to `AuthModal.vue`.
  - Added a login-screen “忘记密码” action and wired it to `auth.resetPassword(...)`.
  - Added store support in `frontend/src/student/stores/auth.ts`.
- Verification:
  - Frontend production build passed after the change.

### 7. Student usage page missed provider/model filters

- Status: fixed
- Severity: medium
- Found during: code review of `Usage.vue` against the migration plan and backend route capabilities
- Symptom:
  - Plan called for usage filters.
  - Backend `GET /api/auth/usage` already accepts `provider` and `model`.
  - The SPA usage page only showed a flat table with no controls.
- Root cause:
  - The frontend migration stopped at basic table rendering and did not carry over the filter controls.
- Fix:
  - Extended `dashboard.loadUsage(...)` to accept filters.
  - Added provider/model controls and query action to `frontend/src/student/views/Usage.vue`.
- Verification:
  - Frontend production build passed after the change.

### 8. Student model group response contract was inconsistent

- Status: fixed
- Severity: low
- Found during: code review of `/api/auth/models` response handling
- Symptom:
  - Backend returns `groups` as objects shaped like `{ provider, items }`.
  - Frontend store typed and stored them as `[provider, items]` tuples.
  - The field was not actively used in most views, but the contract was internally inconsistent and fragile.
- Root cause:
  - The route and store were migrated independently without normalizing the shared shape.
- Fix:
  - Normalized `groups` inside `frontend/src/student/stores/dashboard.ts` before storing.
- Verification:
  - Frontend production build passed after the change.

### 9. Deploy workflow did not strictly follow lockfiles and carried a stale secret

- Status: fixed
- Severity: medium
- Found during: phase 4 deployment-chain review of `.github/workflows/deploy.yml`
- Symptom:
  - GitHub Actions installed dependencies with `npm install`, so CI could drift from `package-lock.json` and `frontend/package-lock.json`.
  - The deploy environment still passed `SILICONFLOW_API_KEY`, while current deployment config and model catalog use `MIMO_API_KEY`, `MINIMAX_API_KEY`, and `DEEPSEEK_API_KEY`.
- Root cause:
  - The workflow was not updated fully after the frontend/package-lock split and provider migration.
- Fix:
  - Changed dependency installation to `npm ci && npm --prefix frontend ci`.
  - Removed `SILICONFLOW_API_KEY` and passed the current optional provider/deploy variables.
- Verification:
  - Static review confirmed `npm run deploy` calls `scripts/deploy-cloudbase.sh`, and that script runs `npm run build:frontend` before staging `src/`.

### 10. Frontend build artifacts had an ambiguous git boundary

- Status: fixed
- Severity: medium
- Found during: phase 4 review of `.gitignore`, `src/public/`, and the deploy script
- Symptom:
  - `src/public/index.html` and `src/public/admin.html` were listed in `.gitignore` but still tracked by Git.
  - Running a frontend build dirtied tracked HTML files that reference ignored hashed assets, making it easy to commit stale entry HTML without the matching assets.
- Root cause:
  - Vite output moved to `src/public/`, but the generated HTML files had not been removed from the index.
- Fix:
  - Kept `src/public/index.html`, `src/public/admin.html`, and `src/public/assets/` as ignored generated output.
  - Added deploy-script checks that fail before CloudBase deploy if the build did not produce both HTML entries and assets.
- Verification:
  - `scripts/deploy-cloudbase.sh` now builds first, verifies the generated entries/assets, then copies `src/` into the staging directory.

### 11. Contributor docs had stale frontend development guidance

- Status: fixed
- Severity: low
- Found during: phase 5 documentation review
- Symptom:
  - `CLAUDE.md`, `DEVELOPMENT.md`, and `frontend/README.md` still said the Vite dev server proxied `/admin`.
  - The admin-page howto did not mention the sidebar entry required for a visible tab.
- Root cause:
  - The docs were partially updated for the Vite/Vue split but still reflected older dev-server assumptions.
- Fix:
  - Updated docs to describe Express + `frontend/` Vite/Vue architecture, true commands, dev/prod admin entry paths, and the `/api` + `/v1` proxy behavior.
  - Added a concrete “add a management tab” checklist covering `views/`, `router.ts`, `Sidebar.vue`, and shared-code placement.
- Verification:
  - Documentation commands were checked against root `package.json` and `frontend/package.json`.

### 12. Student registration dropped the one-time API Key

- Status: fixed
- Severity: high
- Found during: phase 5 registration-flow review
- Symptom:
  - `POST /api/auth/register` returns the plaintext API Key exactly once.
  - The SPA registration modal called `auth.register(...)` but discarded the returned key.
  - After registration, the landing page attempted to navigate to `/overview`, but registration does not create a login token, so the route guard returned the user to landing without ever showing the key.
- Root cause:
  - The refactored `AuthModal` success event had no payload, and `Landing.vue` did not mount `KeyModal`.
- Fix:
  - `AuthModal` now emits the returned API Key on registration success.
  - `Landing.vue` opens `KeyModal` with that key instead of trying to enter the authenticated dashboard.
- Verification:
  - Browser registration validation passed with disposable whitelist record `review-reg-1777684344389`.
  - The API Key modal appeared and displayed a plaintext key beginning with `sk-`.
  - The temporary whitelist record was deleted after validation.

### 13. Direct `/admin.html` entry broke API mount-path detection

- Status: fixed
- Severity: medium
- Found during: phase 4 hash-router compatibility review
- Symptom:
  - `/admin#/students` loaded authenticated admin data correctly.
  - `/admin.html#/students` rendered the same SPA shell, but protected API requests were sent to `/admin.html/api/admin/students` and returned `404`.
- Root cause:
  - `getMountPath()` treated the first path segment as a CloudBase mount prefix unless it matched a small exclude list.
  - The list excluded `admin` but not `admin.html` or `index.html`, so direct HTML entry paths were mistaken for deployment prefixes.
- Fix:
  - Added `admin.html`, `index.html`, and `assets` to the non-prefix segment list in `frontend/src/shared/api/client.ts`.
- Verification:
  - Targeted browser re-check of `/admin.html#/students` passed after rebuild.
  - Console error count for the direct `admin.html` entry re-check was `0`.

## Validation Notes

- Student production page at `http://127.0.0.1:3000/` rendered correctly.
- Admin production page at `http://127.0.0.1:3000/admin` rendered the login screen correctly.
- Admin login API at `POST /api/admin/login` returned `200` with a token using the current `ADMIN_INIT_PASSWORD`.
- Student dev page at `http://localhost:5177/` rendered correctly.
- Admin dev page at `http://localhost:5177/admin.html` rendered correctly after the Vite proxy fix.
- Admin list API at `GET /api/admin/students` returned `200` with a valid admin token.
- Admin usage API at `GET /api/admin/usage?pageSize=5` returned `200` with a valid admin token.
- Admin list API at `GET /api/admin/students` returned `401` without a token, matching the diagnosis that the frontend needed to attach bearer tokens on protected requests.
- Created a dedicated review student account via admin API for authenticated browser validation:
  - studentId: `review-20260501123401`
  - name: `Review Test`
- Student authenticated APIs returned `200` for:
  - `GET /api/auth/profile`
  - `GET /api/auth/models`
  - `GET /api/auth/usage?pageSize=5`
- Student authenticated browser pages rendered correctly with stored login state:
  - `#/overview`
  - `#/guide`
  - `#/usage`
  - `#/models`
- Admin authenticated browser pages rendered correctly with stored login state:
  - `#/students`
  - `#/whitelist`
  - `#/usage`
- Student self-service password reset validated on the dedicated review account:
  - `POST /api/auth/reset-password` returned `200`
  - old password login failed afterwards
  - new password login succeeded afterwards
- Admin password reset validated on the dedicated review account:
  - `PUT /api/admin/students/:id/reset-password` returned `200`
  - previous password login failed afterwards
  - new password login succeeded afterwards
- API key regeneration validated on the dedicated review account:
  - `POST /api/auth/key/regenerate` returned `200`
  - `apiKeyPrefix` changed from `sk-02b87bea` to `sk-9de61621`
  - old API key now fails authentication on `POST /v1/chat/completions` with `401`
  - new API key reaches request validation and returns `400 缺少 model 参数`, proving it is accepted by auth
- Admin whitelist add/delete validated with a disposable record:
  - add returned `200`
  - record was present in `GET /api/admin/whitelist`
  - delete returned `200`
  - record disappeared from the follow-up whitelist query
- Browser-level student interaction flow validated with Playwright:
  - landing page opened login modal
  - “忘记密码” flow completed successfully for `review-20260501123401`
  - success message was shown
  - follow-up browser login reached `#/overview`
  - follow-up API login confirmed old password failed and new password succeeded
- Browser-level student key regeneration validated with Playwright:
  - overview page button opened the confirmation flow
  - API Key modal appeared successfully
  - regenerated key prefix observed in modal: `sk-8dc1f3aa`
- Browser-level admin interaction flow validated with Playwright:
  - login page -> students page completed
  - “添加学生” modal created a disposable student: `ui-review-1777682565001`
  - “重置密码” modal completed for that disposable student
  - follow-up API login confirmed old password failed and new password succeeded
  - whitelist modal added disposable record `ui-wl-1777682565001`
  - whitelist delete button removed that disposable record successfully
- Browser-level admin quota editor validated with Playwright:
  - opened “调额度” modal for `ui-review-1777682565001`
  - saved new quota values `345678 / 876543`
  - follow-up admin API query confirmed the stored quota changed to those exact values
- Browser-level admin usage filter validated with Playwright:
  - filled `26030101` in the usage filter
  - first visible result row matched `26030101`
- Phase 4 deployment-chain review:
  - `npm run build:frontend` passed after deployment/docs changes.
  - `bash -n scripts/deploy-cloudbase.sh` passed.
  - `git diff --check` passed.
  - `npm ci --dry-run` and `npm --prefix frontend ci --dry-run` both completed successfully.
  - A safe `npm run deploy` dry-run with a dummy `tcb` executable reached the final deploy command and verified the staged `index.js`, `public/index.html`, `public/admin.html`, and `public/assets/`.
  - Real `npm run deploy` was not executed against CloudBase.
- Phase 4 path/mount compatibility review:
  - Vite config uses `base: './'`.
  - Student and admin routers use `createWebHashHistory()`.
  - Production `/admin#/students` and `/admin.html#/students` both rendered the admin students page after the `getMountPath()` fix.
  - Temporary Vite dev server at `http://127.0.0.1:5180/admin.html#/login` rendered the admin login page with no console errors.
- Phase 4 browser screenshots were captured under `/tmp/api-share-review-shots` for:
  - desktop 1440x900 student landing, overview, guide, usage, models
  - desktop 1440x900 admin students, whitelist, usage, and direct `admin.html` entry
  - mobile 390px student landing, login/register/reset modals, registration API Key modal, overview, logout guard
  - mobile 390px admin add-student modal and logout guard
- Phase 5 remaining flow validation:
  - Student registration with one-time whitelist record passed; registered test student: `review-reg-1777684344389`.
  - Student logout then direct access to `#/overview` returned to landing.
  - Admin logout then direct access to `#/students` returned to login.
  - Student usage filters were exercised on an empty-record review account without making real upstream calls.

## Pending Validation

- Current environment is live CloudBase data, so any further mutation testing should stay scoped to the dedicated review account and disposable records only.
- Remaining optional work is deeper UX review rather than basic correctness:
  - student usage filter interaction with non-empty records; no safe existing review account with non-empty usage was available, and no real upstream request was made to create one
