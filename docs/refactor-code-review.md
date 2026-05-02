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

## Pending Validation

- Current environment is live CloudBase data, so any further mutation testing should stay scoped to the dedicated review account and disposable records only.
- Remaining optional work is deeper UX review rather than basic correctness:
  - student usage filter interaction with non-empty records
