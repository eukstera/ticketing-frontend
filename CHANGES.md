# Changelog

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
Pending user decision. Proposed phases:
- **Phase 1:** stabilize lint, auth, hydration and the API contract.
- **Phase 2:** search/filters in the URL, ticket detail, and admin pages.
- **Phase 3:** design polish.
