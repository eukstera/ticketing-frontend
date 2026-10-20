# Changelog

## 2026-10-21 — Security fix: credentials in the URL on LAN login

**Symptom.** Logging in from `http://192.168.117.86:3000` reloaded the page as `/?email=…&password=…`, so the credentials ended up in the address bar and browser history, and the user was not logged in.

**Cause (confirmed).** Next 16 dev blocks cross-origin requests to its dev resources unless the origin is listed in `allowedDevOrigins`. The dev log showed `Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "192.168.117.86"`. Only the ngrok host was allowed, so the client JS never hydrated, and the login `<form>` (no `method`, so it defaulted to GET) submitted natively.

**Fix:**
- **`10268bf`:** every password form never submits natively with credentials in the URL. This covers LoginForm, AdminFormModal (user create/edit) and the profile name and password forms:
  - each `<form>` uses `method="post"` and keeps `preventDefault`;
  - the submit button stays disabled until hydrated (`hooks/useHydrated.ts`, built on `useSyncExternalStore`);
  - the login and profile inputs have no `name` attributes, and `autoComplete` is kept.
- **`f5619c2`:**
  - `allowedDevOrigins` is now env-driven through `NEXT_DEV_ALLOWED_ORIGINS` (comma-separated), merged with the ngrok host.
  - The dev API fallback is now `http://localhost:8000/api`, with a one-time console warning when `NEXT_PUBLIC_API_URL` is unset. Production still fails loudly.
  - Added `.env.local.example`. `.env.local` stays git-ignored.
- **`da9481e`:** README sections "LAN / dev setup" and "Tests".
- **`f31abf4`:** Vitest regression tests: `lib/api.test.ts` (9 tests) and `components/auth/LoginForm.test.tsx` (3 tests). They assert that the pre-hydration HTML has `method="post"`, a disabled submit and no credential `name`s, and that `isApiError` exists at runtime.

**Status at `f31abf4`** (checked in a clean worktree): tsc 0, lint 0, `npm test` 12/12 passing.

**LAN dev setup:**
1. Copy `.env.local.example` to `.env.local` and set:
   ```
   NEXT_PUBLIC_API_URL=http://192.168.117.86:8000/api
   NEXT_DEV_ALLOWED_ORIGINS=192.168.117.86
   ```
2. Start the API with `php artisan serve --host=0.0.0.0 --port=8000`, and allow TCP 8000 in Windows Firewall.
3. Restart `npm run dev`.

Do not use the Laragon host `TicketingSystem-API.gbtrghsc.dev`. It serves a different, older copy of the API.

## 2026-10-20 — Phase 1 (stabilize)

Built to the backend Phase 1 contract (`../TicketingSystem-API/CHANGES.md`, BE commit 3ad3391). Work by fe-coder1 (auth, lint, modals), fe-coder2 (API layer, types, pages) and fe-designer (shared UI, a11y).

**Status at `78bbeb0`** (checked in a clean worktree):
- `npx tsc --noEmit` passes.
- `npm run lint` reports 0 problems, down from 37.
- `next build` was not run, per the deploy rule.
- Nothing has been run against the live backend yet, because the backend Phase 1 work is still being deployed.

### Auth & routing
- **Login redirects:** the broken `/auth/login` redirects are gone. Protected pages now use `useAuthGuard()`, built on `useSyncExternalStore`, with `useUser()` for a hydration-safe user read. Logged-out users go to `/` (`93d0ce7`, `aeb2829`, `b027b24`).
- **`lib/auth.ts`:** one `getToken`, a `getUser` that survives corrupt data, `fetchMe()` (`GET /me` refreshes the stored user and role once per page load), `logout()` (`POST /logout`, then clears storage), and `isAdmin` (role name "Department Head"). `register()` was removed (`0cc1d57`, `d99aa75`).
- **Login page:** `/` is login only; public sign-up is gone. LoginForm shows friendly messages for 429 (throttled) and 403 (deactivated account).
- **`user.id===1` checks removed:**
  - The NavBar shows an "Admin" link to Department Heads only.
  - "Create Ticket" is visible to all logged-in users.
  - "Take ticket", Assign and Complete are gated on the ticket's handling department (`606be06`).

### API layer
- **`lib/api.ts` (`28aae33`, `78bbeb0`):**
  - A typed `ApiError {status, message, errors?}`, thrown on non-2xx responses and on `{success:false}`.
  - Non-JSON bodies are read safely.
  - A 401 clears the token and redirects to `/`.
  - Every request accepts an AbortSignal.
  - Production fails loudly when `NEXT_PUBLIC_API_URL` is missing, and the ngrok header is sent in dev only.
  - The report filename comes from `Content-Disposition`, with a generic fallback.
  - `getErrorMessage` gives friendly text for 403, 409 and 429.
- **Types aligned with the backend:** `designation_id` is a number, `status` fields are booleans, activity `user` is `string|null`, and rows carry `department_id`. The legacy Ticket types were removed.
- **One shared list fetcher** now serves both department tickets and my tickets. `takeTicket()` assigns the ticket to the current user through `POST /tickets/{id}/assign`.
- **Lookups from the API:** `lib/lookups.ts` (`/priority`, `/lookups/concern-types`, `/lookups/nature-of-work`) and `getEmployees(departmentId)`. The hard-coded priority and SLA values are gone from the create page.

### Pages
- **Dashboard:** `CardSkeleton` while loading, an `ErrorState` with Retry instead of fake zeros, an abort guard, and a default month in local time.
- **Tickets and My Tickets:**
  - An abort and race guard on the debounced search.
  - `ErrorState` with Retry, and server error messages in toasts.
  - The My Tickets heading is fixed.
- **Create ticket (`299b9fe`):**
  - Priorities, employees and concern types are loaded from the API.
  - 422 errors appear next to each field (`aria-invalid`).
  - The false "created" toast is gone.
  - Lookups show skeletons while loading and a Retry on failure.

### Shared UI & a11y
- **`components/ui` (`5425364`):**
  - `Modal`: dialog role, focus trap and restore, Escape, scroll lock, and a bottom sheet on mobile.
  - `Skeleton`, `TableSkeleton` and `CardSkeleton`.
  - `EmptyState`, `ErrorState` and `Avatar`.
  - Button and input class constants in `lib/styles.ts`.
- **Modals on the shared shell:** Comments, Assign, Accomplishment and Confirm now use `Modal` (`125a101`, `c1aca12`). A 403 on comment edit shows a clear message.
- **Toast (`f60861a`):** an aria-live region, a dismiss button, pause on hover, a responsive width, and lucide icons.
- **TimelineStepper (`8932d9f`):** the invalid `w-25` is fixed, steps stack on mobile, and contrast is improved.
- **`docs/DESIGN.md`:** design tokens, patterns and page specs (`312f08b`), plus the Phase 3 polish list (`3f67e2f`).

### Open items carried into Phase 2
- The "Take ticket" UI is built, but the pages don't pass `onTake` to the table yet. fe-coder2 is wiring it in the shared list.
- The `/admin` link returns 404 until the Phase 2 admin pages land.

## 2026-10-20 — Baseline health scan

Read-only audit; no code changed. Audited by fe-coder1 (lint/hooks/auth), fe-coder2 (API layer and backend contract) and fe-designer (design/a11y/UX), compiled by fe-orchestrator.

### Versions & status
- Next.js 16.2.10, React 19.2.4, TypeScript 5, Tailwind 3.4, lucide-react. Deployed via pm2 (`ecosystem.config.js`).
- `.env.production`: `NEXT_PUBLIC_API_URL=https://backend_ticketing.apps.gbtrghsc.local/api`
- `npx tsc --noEmit`: passes.
- `npm run lint`: 37 problems (18 errors, 19 warnings):
  - `react-hooks/set-state-in-effect` ×13 (E)
  - `react-hooks/immutability` ×5 (E)
  - `react-hooks/exhaustive-deps` ×4 (W)
  - `no-unused-vars` ×14 (W)
  - unused eslint-disable ×1 (W)

### Critical
- **Logged-out redirect goes to a 404.** Protected pages call `router.push('/auth/login')` but no `app/auth/` exists; login lives at `/`. Affected: `app/dashboard/page.tsx:30`, `app/tickets/page.tsx:43`, `app/my-tickets/page.tsx:51`, `app/tickets/create/page.tsx:102`.
- **Create ticket always reports success.** The backend returns validation failures as HTTP 200 `{success:false, errors}` (`TicketingController.php:125-131`). `lib/api.ts:22-24` only throws on `!res.ok`, and `create/page.tsx:148-160` ignores the result, so it toasts "created" and redirects even when the ticket was rejected. Login and register follow the same pattern (`AuthController.php:36,56`; `lib/auth.ts:34`).
- **Backend security (backend team):**
  - `POST /register` is public and trusts the client's `role_id`/`department_id` (`AuthController.php:26-27`), so anyone can self-register with any role.
  - `GET /getTicketRequests` is public and filters by a client-supplied `requestorId`, which is an IDOR (`TicketingController.php:521`).
  - `/designations`, `/saveTicketIT` and `/saveTicketEngineering` are also outside `auth:sanctum` (`routes/api.php:12-25`).

### High
- **No 401 handling:** `lib/api.ts:22-23`. An expired or revoked token leaves broken pages, and the stale token stays in localStorage.
- **Route protection is client-only:** each page has its own `mounted`/`checked` effect, and there is no `proxy.ts` (Next 16 renamed middleware to proxy). The token lives in localStorage (`lib/auth.ts:4`), so the server cannot gate pages, and it is exposed to XSS.
- **Logout is local only:** `components/NavBar.tsx:29-32` never calls the server, so the token stays valid there.
- **Role gating by hard-coded user id 1:** `NavBar.tsx:27` and `ActionCell.tsx:14-26`. `/tickets/create` itself is unguarded.
- **Error contract is inconsistent:** 422 `{message,errors}`, 200 `{success:false}`, 401, and a 200 with only `{message}` (`CommentController.php:57-61`). The frontend has no `ApiError` type and shows generic strings. `updateTicketComment` returns `undefined` in that last case (`lib/tickets.ts:70-77`).
- **Priorities are hard-coded in the frontend:** ids 1-4 and SLA values (`create/page.tsx:43-48`), and `PRIORITY_STYLES` is keyed by label. The backend has per-department priorities with level and SLA, and `GET /priority?department_id` is unused.
- **Dashboard priority filter does nothing:** the backend has that filter commented out (`TicketingController.php:640,651`). The month default uses the UTC month (`dashboard/page.tsx:15`).
- **"Overdue" is only set by a state-changing `GET /overdueTickets`,** which nothing calls (`TicketingController.php:253-268`). Overdue counts are stale unless a cron job exists.
- **Assignee list mismatch:** `GET /employees` returns the caller's department, while create hard-codes `service_department=1` (`create/page.tsx:16,149`).
- **Backend assign/complete bugs:** each reassign adds another activity row, and complete uses the oldest assignee and can null-deref into a 500 (`TicketingController.php:585-611`).
- **Inaccessible modals:** none of them has role="dialog", aria-modal, a focus trap or focus restore, and only AccomplishmentModal closes on Escape. Affected: `ConfirmModal.tsx:44`, `AssignModal.tsx:78`, `CommentsModal.tsx:119`.
- **Unlabelled controls:**
  - Icon-only buttons (NavBar avatar/hamburger, CommentButton, CommentsModal ✕) have no labels.
  - The expandable table row is mouse-only (`TicketsTable.tsx:106-117`).
  - Form labels are not tied to their fields (`create/page.tsx:60-73,196,229`; `AuthField.tsx:26-37`).
  - Radio cards nest an `<input>` inside a `<button>` (`create/page.tsx:343-366`).
- **Mobile layout breaks:**
  - The 10-column `min-w-[900px]` table scrolls sideways with its actions off-screen (`TicketsTable.tsx:40`).
  - `TimelineStepper.tsx:30` uses `w-25`, which is not a Tailwind 3.4 class, so it overflows.
- **Duplicated style maps:** `lib/styles.ts` keeps legacy maps (`:6-75`) next to `STATUS_STYLES`/`PRIORITY_STYLES` (`:105/:152`), and they disagree (Complex is purple in one, fuchsia in the other).
- **Copy-pasted ticket pages:** `tickets/page.tsx` and `my-tickets/page.tsx` are about 95% the same, and my-tickets is mis-titled "Department Tickets" (`:163-165`).
- **Loading and errors:** loading is plain text with no skeletons, errors have no retry, and the modals swallow fetch errors (`AssignModal.tsx:53-55`, `CommentsModal.tsx:46-48`).

### Medium
- **Hydration risk:** `getUser()` is read during render (`CommentsModal.tsx:24`, `ActionCell.tsx:14`).
- **`getUser()` crashes on corrupt data:** it calls `JSON.parse` without try/catch (`lib/auth.ts:20-22`).
- **Duplicated helpers:** `getToken` exists in both `lib/api.ts:3` and `lib/auth.ts:9`, and `lib/tickets.ts:97-110` re-reads the user by hand.
- **Non-JSON responses crash parsing:** `res.json()` runs before the ok check, so a 502 or 204 throws `SyntaxError` (`lib/api.ts:22-23`).
- **Out-of-order results:** there is no abort or race guard on the debounced ticket and dashboard fetches (`tickets/page.tsx:59-90`, `my-tickets/page.tsx:67-98`, `dashboard/page.tsx:35-52`).
- **Dashboard hides failures:** after an error it shows `0`s that look like real data (`dashboard/page.tsx:81-94`).
- **Type drift in `types/index.ts`:**
  - Legacy `Ticket`/`TicketStatus`/`Priority` interfaces match nothing the backend returns.
  - `DepartmentTicket` lacks `priority_sla` and `type_of_tech_support`.
  - `User.designation_id` is typed as a string but RegisterForm uses a number.
  - Concern type is free text in the backend but a fixed union in the frontend.
- **Inconsistent styling:**
  - Three different input focus styles, and several inputs use `outline-none` with no visible focus.
  - Buttons are re-declared inline, and the modal shell is duplicated 4 times.
  - The avatar is duplicated 4 times, and the auth palette is hard-coded hex.
- **Contrast:** `text-gray-400` and `gray-300` are used for real content.
- **Accessibility:** the Toast has no live region, dropdowns lack aria-expanded and Escape, and the password toggle has `tabIndex=-1`.
- **Mobile:**
  - Pagination doesn't wrap.
  - `AssignModal` has a fixed `h-[600px]`.
  - The tickets pages use `px-6` while the dashboard uses `px-4 sm:px-6`.
- **Missing states:** empty results don't tell "no tickets" apart from "no matches", and the create form has no field-level validation messages.
- **Unused props:** DashboardFilters `priorityFilter/onPriorityChange` and StatCard `color` are dead, which suggests that functionality was dropped.

### Low
- **API URL fallback:** a missing `NEXT_PUBLIC_API_URL` silently falls back to `http://ticketing-api.test/api` (`lib/api.ts:1`), a dev host over http.
- **ngrok header in production:** `ngrok-skip-browser-warning` is sent on every request and forces a CORS preflight (`lib/api.ts:18,41`).
- **`next.config.ts`:** mixes CommonJS with imports, has `reactStrictMode:false`, and hard-codes an ngrok host in `allowedDevOrigins`.
- **Misnamed file:** `lib/departmentTickets.ts` only holds types.
- **Emoji icons:** they render differently per OS even though lucide-react is installed, and one inline SVG is copy-pasted 3 times.
- **Backend inconsistencies:**
  - Some GETs return 201, and `/priority` returns a bare array.
  - The comment update returns the full user record.
  - Search covers only `ticket_number` and `name_of_area`.
- **Login flash:** the login page renders blank until hydration (`app/page.tsx:20`).

### Current design (keep and polish, no redesign)
- **Tokens:** stock Tailwind. `theme.extend` is empty, and `globals.css` sets only the system font, a `#f5f5f5` background and `#1a1a1a` text.
- **App palette:** gray neutrals with blue-600 as primary. Cards are `bg-white rounded-xl border-gray-200`, modals `rounded-2xl` on a `bg-black/40` backdrop, and pages use `max-w-7xl` with `bg-gray-50`.
- **Auth palette:** teal and ink hex values with an orange accent and serif headings.
- **Status colours** (`STATUS_STYLES`): Open is blue, In-progress amber, Completed green, Overdue red.
- **Priority colours** (`PRIORITY_STYLES`): each priority has text, pill, badge, solid and highlight variants.
- **Patterns:**
  - Rounded-full status badges and filter pills, with `ring-2 ring-offset-1` marking the selected pill.
  - Tables with a gray-50 thead, then Pagination.
  - A global `toast()`.
  - Red-50 error banners.
  - The `tickets/create` form as the reference form.

### Missing backend endpoints (needed for Phase 2)
- Ticket by id (`GET /tickets/{id}`).
- CRUD for users/roles, departments, priorities+SLA, and concern types (only a priority list and an employee list exist).
- Comment delete, `per_page`/sort, a date-range filter, role checks, and logout/me.

### Planned
User decisions (relayed by master-orchestrator, 2026-10-20):
- Registration is admin-only. `/` becomes login only, and user creation moves to the admin pages, reusing the RegisterForm fields.
- Admin gating uses the role from `GET /me`, replacing the `user.id===1` check.
- Requestor routes are unchanged; the frontend doesn't use them.
- Any employee of the handling department may take any ticket. Add a "Take ticket" (self-assign) action next to assign-to-employee; assigning is not limited to Heads.
- The backend returns real 4xx errors `{success:false, message, errors?}` (422/403/404/401). The frontend builds one `ApiError` handler around that.
- Tokens expire after 7 days. A global 401 handler clears the token and redirects to `/`.

Contract confirmations from the backend:
- Activity `user` is `string | null`.
- `User.status` is a boolean, and `designation_id` is a number.
- Password is hidden in user payloads.
- Comment responses include `user {id, first_name, last_name}`.
- CORS exposes `Content-Disposition`, so the frontend's filename fallback can be removed.

Phases:
- **Phase 1 (stabilize):**
  - **Auth (fe-coder1):**
    - Fix the `/auth/login` redirects.
    - Add `useUser`/`useAuthGuard` hooks built on `useSyncExternalStore`.
    - Fix all lint errors and warnings.
    - Read the user in a hydration-safe way.
    - Use `GET /me` for the role, and gate the NavBar and pages on it.
    - Call `POST /logout`.
    - Make `/` login only.
  - **API layer (fe-coder2):**
    - Rework `request()` around a typed `ApiError` (422 errors, 401 → clear token and redirect), and handle non-JSON bodies safely.
    - Check that `NEXT_PUBLIC_API_URL` is set, and send the ngrok header in dev only.
    - Add abort and race guards to fetches.
    - Align types with the backend.
    - Load priorities and SLA from `/priority`, employees from `/employees?department_id`, and concern types and nature of work from `/lookups/*`.
    - Read the report filename from `Content-Disposition`.
    - Add the "Take ticket" action.
    - Stop sending the dashboard `priority` param (unless the backend implements it), and compute the default month in local time.
  - **Quick wins (fe-designer):** fix `TimelineStepper` `w-25`, correct the my-tickets title, show a dashboard error state instead of zeros, and turn the polish checklist into specs.
- **Phase 2 (features):** built against the backend's CHANGES.md "API contract".
  - A shared ticket list page with URL-synced filters (keyword, status, priority, date range, per_page, sort).
  - A ticket detail page at `app/tickets/[id]`, including comment delete.
  - Admin CRUD for users/roles (including user creation), departments, priorities+SLA, and concern types, shown in the NavBar only to admins.
  - fe-designer delivers the shared `<Modal>`, button/input constants and skeleton/empty/error states first.
- **Phase 3 (polish):**
  - Consolidate `styles.ts`.
  - Responsive table cards.
  - lucide icons.
  - Contrast and focus fixes.
  - Auth palette as theme tokens.
