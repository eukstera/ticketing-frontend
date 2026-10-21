# Design guide

The look is fixed: polish, don't redesign. Stock Tailwind 3 utilities, no custom theme tokens.

## Tokens

| | |
|---|---|
| Page | `min-h-screen bg-gray-50`; content `max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6` |
| Card | `bg-white rounded-xl border border-gray-200` (+ `p-4 sm:p-6`) |
| Text | headings `text-gray-800`, body `text-gray-600/700`, muted `text-gray-500` (never gray-400/300 for real text: contrast) |
| Primary | `blue-600` (hover `blue-700`); success `green-600`; danger `red-600` |
| Type | `text-sm` default; page h1 `text-lg font-semibold`; card h3 `text-base font-semibold`; th `text-xs font-medium text-gray-500` |
| Radii | cards `rounded-xl`, modals `rounded-2xl`, controls `rounded-lg`, pills/avatars `rounded-full` |
| Shadow | dropdowns `shadow-lg`, toasts `shadow-md`; modals none |
| z-index | dropdown 10-20, modal 50, toast 100 |
| Icons | `lucide-react`, size 14/16, `text-gray-400` decorative; no emoji |

Status and priority colours: **only** via `STATUS_STYLES` / `PRIORITY_STYLES` in `lib/styles.ts` (Open blue, In-progress amber, Completed green, Overdue red; priorities red / orange / amber / purple / fuchsia / emerald). Never hand-write these classes in pages.

## Shared building blocks (already built)

### `lib/styles.ts` constants
`btnPrimary`, `btnSecondary`, `btnDanger`, `btnSuccess` (all `rounded-lg px-4 py-2 text-sm font-medium` with `focus-visible:ring-2`), `btnSm` (size modifier `px-3 py-1.5 text-xs`), `input` (full-width, `focus:ring-2 ring-blue-500/30`), `inputError` (append to `input`).
Usage: `className={`${btnPrimary} ${btnSm}`}`.

### `components/ui/*`
- `Modal` `{ isOpen, onClose, title?, ariaLabel?, size?: 'sm'|'md'|'lg', footer?, closeOnBackdrop?, bodyClassName?, panelClassName?, children }`. `role="dialog"`, `aria-modal`, `aria-labelledby` (title), focus trap + restore, Escape, backdrop mousedown closes, body scroll lock, bottom sheet below `sm`. Pass `ariaLabel` when there is no `title`. Set `closeOnBackdrop={false}` while saving.
- `Skeleton`, `TableSkeleton { rows?, columns? }`, `CardSkeleton { lines?, className? }`.
- `EmptyState { icon?, title, description?, action?: { label, onClick }, className? }`.
- `ErrorState { message, onRetry?, className? }`, `role="alert"`.
- `Avatar { firstName?, lastName?, size?: 'sm'|'md'|'lg', className? }`, decorative (`aria-hidden`).

## Patterns for new pages

- **Page header**: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4`; h1 + `text-sm text-gray-500` subtitle left, actions right.
- **Async states** (every list/detail page): loading → `TableSkeleton`/`CardSkeleton`; failed → `ErrorState` with `onRetry`; empty → `EmptyState`. Keep old rows visible (`opacity-60`) while refetching instead of unmounting.
- **Empty variants**: no data at all → "No tickets yet" with no action; filters active and 0 results → "No tickets match your filters" with `action: { label: 'Clear filters', onClick }`. Inside a table, render the `EmptyState` in `<tr><td colSpan={n}>`.
- **Mutation feedback**: `toast(msg, 'success' | 'error')`; pending buttons `disabled` + label swap ("Saving…").
- **Tables**: wrapper `bg-white rounded-xl border border-gray-200 overflow-x-auto`; `thead bg-gray-50`; cells `px-4 py-3`; `divide-y divide-gray-100`; header cells `scope="col"`; row toggles are real `<button aria-expanded>`. Below `md`, prefer stacked cards or keep the first column + actions visible.
- **Forms**: label with `htmlFor` + input `id`; errors `text-xs text-red-600` linked via `aria-describedby`, input gets `aria-invalid` + `inputError`; required marker `<span className="text-red-500">*</span>`; stack `space-y-5`; two columns from `sm:grid-cols-2`.

## Specs for Phase 2 pages

### Filter bar (list pages)
```
[ status pills (wrap) ............................ ][ priority dropdown ]
[ keyword search (flex-1, max-w-xs) ][ date from ][ date to ][ Clear ]
```
- Container `flex flex-col gap-3 mb-4`; rows `flex flex-wrap items-center gap-2`.
- Status pills: reuse `FilterPills` markup; add `aria-pressed`. Priority dropdown: `aria-haspopup="listbox"`, `aria-expanded`, Escape closes.
- Keyword: `input` with a `Search` lucide icon (left, `pl-9`) and an X clear button; debounce 300 ms; `aria-label="Search tickets"`.
- Date range: two `<input type="date" className={input}>` (`w-auto`), labels "From"/"To"; invalid when `to < from` (`inputError` + message).
- "Clear filters" shows only when any filter is active; it is the same handler `EmptyState` uses.

### Ticket detail (`app/tickets/[id]`)
```
Navbar
max-w-5xl mx-auto px-4 sm:px-6 py-6
  ← Back to tickets                       (text-sm text-blue-600)
  Header card: ticket # (text-xl semibold) · StatusBadge · priority badge · actions (btnPrimary/btnSecondary btnSm)
  grid lg:grid-cols-3 gap-5
    main (lg:col-span-2, space-y-5)
      Card "Details": <dl> grid sm:grid-cols-2 gap-4; dt text-xs text-gray-500, dd text-sm text-gray-800
      Card "Timeline": TimelineStepper
      Card "Actions taken": comment list (Avatar + name + time + text) and add-comment form
    aside (space-y-5)
      Card "People": requester / assigned (Avatar + name)
      Card "Devices" (hardware tickets only)
```
Loading: `CardSkeleton` per card; error: `ErrorState` with Retry; not found: `EmptyState` + back link. Cards stack in the order above below `lg`.

### Admin CRUD
List page = header (title + `btnPrimary` "New X") + filter bar + table + `Pagination`. Create/edit in a `Modal size="md"` with `footer` = Cancel (`btnSecondary`) / Save (`btnPrimary`); delete via `ConfirmModal variant="danger"` (to be rebuilt on `Modal` by the modal migration).

## Accessibility checklist for new UI
Icon-only buttons have `aria-label`; interactive elements show `focus-visible` rings; modals use `Modal`; status never by colour alone (text label present); text contrast ≥ gray-500 on white; touch targets ≥ 36px on mobile.

---

# Phase 3 polish list

Ordered by priority. Line numbers are from the working tree at the time of writing (after Phase 1 commits). Files marked **(in flight)** are being edited by fe-coder1/2 in Phase 1/2, so re-grep before editing; the class changes still apply. "Owner" is a suggestion. No visual redesign: every item keeps today's look except where stated.

## P1 (High)

### 0. One form field: `components/ui/Field.tsx` (do this first)
Owner: fe-designer. Four hand-rolled field implementations each re-solve label association, required markers, hints, errors and `aria-*`, and have already drifted (different focus styles, error markup, `*` handling):

| Where | What it is |
|---|---|
| `components/auth/AuthField.tsx` | auth palette (hex), `useId`, password toggle, `role="alert"` error |
| `components/admin/AdminFormModal.tsx` (field loop `:245-289` + `SelectField` `:89-138`) | inline label/input/select/help/error per field, `aria-describedby` for errors only (help text is not linked) |
| `app/profile/page.tsx` `TextField` (`:16-66`) | `htmlFor`/`id`, hint + error ids joined into `aria-describedby`, `role="alert"` |
| `app/tickets/create/page.tsx` `FieldLabel` (`:50`) + `FieldError` (`:64`) + per-field wiring | icon label with `htmlFor`, errors via `fe(name)`/`cls(name)` |

Also touched by the same shape: `components/auth/RegisterForm.tsx` selects (labels without `htmlFor`) and the `AccomplishmentModal` date labels.

Target API (app tokens; the auth form keeps its own look through a `tone="auth"` prop or by passing its class strings, same values):
```tsx
<Field label="First name" required hint="As on your ID" error={errors.first_name?.[0]} icon={User}>
  {(p) => <input {...p} className={input} value={...} onChange={...} />}   // render-prop spreads { id, required, 'aria-invalid', 'aria-describedby' }
</Field>
```
- `Field` generates the id with `useId`, renders `<label htmlFor>` (+ optional lucide `icon`, `*` marker `aria-hidden`), the hint `<div id=...-hint>` and the error `<p id=...-error role="alert">`, and hands `{ id, required, 'aria-invalid', 'aria-describedby': [hint?, error?] }` to its child. It also exports `fieldClass(error?: boolean)` -> `input` or `input + inputError`.
- Migrate in this order: profile -> admin form -> create ticket -> auth (last, because of the palette). Each migration must keep its tests green (`npm test`).
- Done when `grep -rn "htmlFor" app components` only matches `Field.tsx` and the few intentional implicit-label cases.

### 1. Consolidate `lib/styles.ts` legacy maps onto `STATUS_STYLES` / `PRIORITY_STYLES`
Owner: fe-designer (styles.ts) + the file owners below for call sites. Do styles.ts first, then switch callers, then delete the old exports.

**1a. Extend the canonical maps** (`lib/styles.ts`):
- `PriorityStyle` (:140) gains `dot: string` and `ring: string`. Values come straight from the legacy maps: dot = `PRIORITY_DOT` (:47-54: red-600, orange-600, amber-500, purple-500, fuchsia-500, emerald-500), ring = `PRIORITY_RING` (:65-73: `ring-{red,orange,amber,purple,fuchsia,emerald}-400`). `PRIORITY_FALLBACK` (:197) gets `dot: 'bg-gray-400'`, `ring: 'ring-gray-400'`.
- `StatusStyle` (:96) gains `card: string` = the `STAT_CARD_THEME` strings (:6-11), e.g. Open `bg-blue-100 border-blue-200 text-blue-700 hover:bg-blue-200`. `STATUS_FALLBACK` (:128) gets a neutral `card`.
- New `export const STATUS_ALL: StatusStyle` for the "All" pill: `pill: 'bg-gray-100 text-gray-700 border-gray-300'`, `ring: 'ring-gray-400'`, gray `badge`/`card`.
- Fix `highlight` (:158-202): only the first entry has a text colour. Make every entry `bg-X-100 border-X-200 text-X-700` (X = orange, amber, purple, fuchsia, emerald). `PRIORITY_FALLBACK.highlight` (:202) is fuchsia by mistake -> `'bg-gray-100 border-gray-200 text-gray-700'`.

**1b. Complex purple vs fuchsia mismatch.** `PRIORITY_COLOR_MAP['Complex']` (:19) is `bg-purple-500` while every other Complex variant (text/pill/badge/ring/dot/solid) is fuchsia. Fuchsia is canonical. This is the only visible change in the whole consolidation: the Complex bar in the dashboard Priority Statistics goes `bg-purple-500` -> `bg-fuchsia-500`. All other legacy values already equal their `PRIORITY_STYLES.solid` counterparts (Urgent & IHOMIS red-500, Urgent orange-500, Important amber-400, Long Term purple-400, Simple emerald-400).

**1c. Switch call sites, then delete legacy exports:**

| File:line | Now | Change to |
|---|---|---|
| `components/department-tickets/FilterPills.tsx:3` | imports 10 legacy maps | `import { STATUS_STYLES, STATUS_ALL, PRIORITY_STYLES, PRIORITY_FALLBACK } from '@/lib/styles'` |
| `FilterPills.tsx:7` | `STATUS_PILL_DEFS.map(...)` | build from `(STATUS_STYLES[label] ?? STATUS_ALL).pill` over `['All','Open','In-progress','Completed','Overdue']` |
| `FilterPills.tsx:21,55` | `PRIORITY_PALETTE[level] ?? FALLBACK_COLOR` | `(PRIORITY_STYLES[level] ?? PRIORITY_FALLBACK).pill` |
| `FilterPills.tsx:56,58,59,119,120` | `PRIORITY_DOT/BADGE/RING[...] ?? FALLBACK_*` | `.dot` / `.badge` / `.ring` of the same `PRIORITY_STYLES[...] ?? PRIORITY_FALLBACK` lookup |
| `FilterPills.tsx:71` | `STATUS_RING[pill.label] ?? 'ring-gray-400'` | `(STATUS_STYLES[pill.label] ?? STATUS_ALL).ring` |
| `components/dashboard/PriorityStatistics.tsx:2-3,17` | `PRIORITY_COLOR_MAP` + fallback array | `PRIORITY_STYLES[row.level]?.solid ?? PRIORITY_SOLID_FALLBACKS[i % n]` (keep the 3 fallback colours as `PRIORITY_SOLID_FALLBACKS`) |
| `components/dashboard/StatCard.tsx:4,15,25` | `STAT_CARD_THEME[status]` | `(STATUS_STYLES[status] ?? STATUS_FALLBACK).card`; type `status: string` |
| `components/department-tickets/StatusCell.tsx:2,6` | flat `statusStyles[...] \|\| 'bg-gray-100 text-gray-700'` | `(STATUS_STYLES[ticket.status] ?? STATUS_FALLBACK).badge` |
| `components/department-tickets/TicketsTable.tsx:2,122` **(in flight)** | flat `priorityStyles[...] \|\| 'text-gray-600'` | `(PRIORITY_STYLES[ticket.priority] ?? PRIORITY_FALLBACK).text` |
| `app/tickets/create/page.tsx:50-58` | local `PRIORITY_META` (dot/text) | drop it; use `PRIORITY_STYLES[p.label].dot` if the dot is wanted (the dot span at :361 is commented out) |

When no caller is left, delete from `lib/styles.ts`: `STAT_CARD_THEME`, `PRIORITY_COLOR_MAP` (+ `_FALLBACK_COLORS`, replaced by `PRIORITY_SOLID_FALLBACKS`), `STATUS_PILL_DEFS`, `PRIORITY_PALETTE`, `PRIORITY_DOT`, `PRIORITY_BADGE`, `PRIORITY_RING`, `STATUS_RING`, `FALLBACK_*`, and the flat `statusStyles` (:136) / `priorityStyles` (:207).

**1d. Housekeeping in the same pass:**
- `lib/styles.ts:1` imports `StatusPill` from `@/lib/departmentTickets` (a type): make it `import type`, or drop it once `STATUS_PILL_DEFS` is gone.
- Move `formatDateTime` (:224) to a new `lib/format.ts` (`components/department-tickets/ActionInfo.tsx:2` is the only importer; `CommentsModal.tsx:105` has its own near-duplicate to replace with it). Delete the stale `// lib/ticketStyles.ts` comment (:90).
- `TimelineStep.icon` (:215-221): change `icon: string` (emoji) to `icon: LucideIcon` with `Flag` / `User` / `Check`; `TimelineStepper.tsx` renders `<step.Icon size={12} aria-hidden="true" />` (also item 4).

### 2. Responsive card layout for `TicketsTable` below `md`
Owner: fe-designer spec, fe-coder1 implements after their Phase 2 commit (file **in flight**).
`components/department-tickets/TicketsTable.tsx`:
- `:35` wrapper (`min-w-[900px]` table): add `hidden md:block` to the existing wrapper div (`bg-white rounded-xl border border-gray-200 overflow-x-auto hidden md:block`).
- Add a sibling `<ul className="md:hidden space-y-3">` rendering one `<li className="bg-white rounded-xl border border-gray-200 p-4">` per ticket:
  - header: `flex items-start justify-between gap-3` with the ticket number (`text-sm font-semibold text-gray-800`) and `<StatusCell>`;
  - body: `<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">`; each pair is `<dt className="text-xs text-gray-500">` / `<dd className="text-gray-700">` for Concern/Nature of work, Area, Priority (as a `PRIORITY_STYLES[...].badge` pill), Elapsed (`LiveTimer`); `<ActionInfo>` spans both columns (`col-span-2`);
  - footer: `mt-3 flex items-center justify-between gap-3` with `<ActionCell>` left and `<CommentButton>` right;
  - details: `<button type="button" aria-expanded aria-controls className="mt-3 text-xs font-medium text-blue-600 inline-flex items-center gap-1">` ("Details" + `ChevronDown`) reveals the same timeline/remarks/devices/supervisor block, stacked.
- Desktop expanded row: `:151` `grid grid-cols-2 gap-6` -> `grid grid-cols-1 gap-6 md:grid-cols-2`; `:157` `border-l border-gray-200 pl-6` -> `md:border-l md:border-gray-200 md:pl-6`; `:150` td `px-8` -> `px-4 md:px-8`.
- Share row content through small components (`TicketMeta`, `TicketDetails`) so both layouts render the same data.

### 3. Contrast and focus-visible sweeps
Owner: fe-designer for shared pieces; file owners for in-flight files. Rule: real text is at least `gray-500` on white; decorative icons may stay `gray-400`; every interactive element shows a ring on keyboard focus.

**3a. Focus-visible** (add `focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500` unless noted; add a `focusRing` constant to `lib/styles.ts` with exactly that string and reuse it):
- `components/NavBar.tsx:70-77` and `:137-145` links: append `rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none`.
- `NavBar.tsx:92-98` avatar button: add `aria-label="Account menu" aria-haspopup="menu" aria-expanded={userMenuOpen}` + ring (keep `title`).
- `NavBar.tsx:121-129` hamburger: add `aria-expanded={menuOpen} aria-controls="mobile-menu"` (give the panel at :135 `id="mobile-menu"`) + ring; replace the 3 hand-made spans with lucide `Menu` / `X` size 20 (`p-2` -> `p-2.5` for a 40px target).
- `components/auth/AuthField.tsx:45`: delete `tabIndex={-1}` so keyboard users can reveal the password; button gets `focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5C57]/40 rounded`.
- `components/department-tickets/CommentButton.tsx:4`: add ring; `w-6 h-6` -> `w-8 h-8`; add `aria-label={count ? `Actions taken (${count})` : 'Actions taken'}`.
- Search boxes where the input has `outline-none` and no ring: the wrapper `div` gets `focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30`; add `aria-label` to the `<input>`. Sites: `app/tickets/page.tsx:158-165` **(in flight)**, `app/my-tickets/page.tsx:161-168` **(in flight)**, `components/AssignModal.tsx:89-96`.
- `components/dashboard/DashboardFilters.tsx:45`: replace `focus:border-blue-500 focus:outline-none` with the shared `input` string plus `sm:w-auto` (adds the ring) and `aria-label="Month"`.
- `components/CommentsModal.tsx:164` Edit button is `opacity-0 group-hover:opacity-100`, so keyboard users never see it: add `focus-visible:opacity-100` (and `text-gray-400` -> `text-gray-500`).
- `components/department-tickets/FilterPills.tsx:66,81,98,122`: add ring classes; status pills `aria-pressed={statusFilter === pill.value}`; trigger `aria-haspopup="listbox" aria-expanded={open}`; Escape closes the dropdown.
- `TicketsTable.tsx:105-117` **(in flight)**: the expand control becomes a real `<button type="button" aria-expanded aria-controls className="rounded focus-visible:ring-2 focus-visible:ring-blue-500">` inside the first cell (remove `onClick` from the `<td>`s).

**3b. Contrast** (`text-gray-400` -> `text-gray-500`; `text-gray-300` -> `text-gray-500`), text only:
- `components/CommentsModal.tsx:138,140,157,159,164`; `components/AssignModal.tsx:105,107`; `components/dashboard/PriorityStatistics.tsx:14,33`; `components/dashboard/TopPerformerCard.tsx:22`.
- `components/department-tickets/FilterPills.tsx:86,110,135`; `Pagination.tsx:35` (ellipsis); `NavBar.tsx:107,153`.
- **(in flight)** `components/department-tickets/TicketsTable.tsx:56,153,160,171,180` and `:139` (`text-gray-300` "—"); `ActionCell.tsx` "—" spans (`text-gray-300`); `ActionInfo.tsx` label lines (`text-gray-400`).
- `app/tickets/create/page.tsx:78,79,217,395,419` (`text-gray-300` at :79) and `PRIORITY_META.text` (:54-57).
- Do not touch decorative icon colours (`<Icon ... className="text-gray-400">`).

**3c. Misc a11y found on the way:** `AuthField.tsx:26-37` label is not tied to its input -> `useId()` + `htmlFor`/`id`, `aria-invalid`, `aria-describedby` for the error line (:63) with `role="alert"`; `AccomplishmentModal.tsx:195,207` labels need `htmlFor`/`id`; `app/tickets/create/page.tsx:60-73,196,229` `FieldLabel` needs `htmlFor`.

## P2 (Medium)

### 4. Lucide swap for the remaining emoji / inline SVG
Owner: fe-designer (shared/modal files), file owners for in-flight ones. Decorative icons get `aria-hidden="true"`.

| File:line | Now | Replace with |
|---|---|---|
| `app/tickets/page.tsx:159`, `app/my-tickets/page.tsx:162`, `components/AssignModal.tsx:90` | `🔍` span | `<Search size={16} className="text-gray-400" aria-hidden="true" />` |
| `app/my-tickets/page.tsx:180`, `components/AccomplishmentModal.tsx:147,255` | inline download SVG (3 copies) | `<Download size={18} />` (14 inside the button at :255) |
| `components/AccomplishmentModal.tsx:168` | close X SVG | `<X size={16} />` (or migrate the modal onto `Modal`, which provides the close button) |
| `AccomplishmentModal.tsx:222` | alert SVG | `<ErrorState message={errorMsg} />` |
| `AccomplishmentModal.tsx:247` | spinner SVG | `<Loader2 size={14} className="animate-spin" />` |
| `components/AssignModal.tsx:129` | `✓` | `<Check size={16} className="text-blue-600" />` |
| `components/CommentsModal.tsx:131` | `✕` text button | removed by migrating onto `Modal title="Actions Taken"` (built-in `X` + `aria-label="Close"`) |
| `app/tickets/create/page.tsx:257` | `✕` | `<X size={16} />` (aria-label already present) |
| `components/auth/AuthField.tsx:48,55` | eye-off / eye SVGs | `<EyeOff size={18} strokeWidth={1.8} />` / `<Eye size={18} strokeWidth={1.8} />` |
| `components/department-tickets/CommentButton.tsx:7` | speech-bubble SVG | `<MessageSquare size={14} />` |
| `components/department-tickets/FilterPills.tsx:91` | chevron SVG | `<ChevronDown size={14} className="text-gray-500 mr-1" />` |
| `components/department-tickets/TicketsTable.tsx:109,135` **(in flight)** | `▼`/`›`, `⏱` | `ChevronDown`/`ChevronRight` size 16; `Timer` size 12 |
| `lib/styles.ts:219-221` + `TimelineStepper.tsx:36` | `🚩 👤 ✓` | `Flag` / `User` / `Check`, size 12 (see 1d) |
| `components/NavBar.tsx:126-128` | 3-span hamburger | `Menu` / `X` size 20 (see 3a) |

### 5. `Pagination` wrap and semantics
Owner: fe-designer (file not in flight). `components/department-tickets/Pagination.tsx`:
- `:21` `flex items-center justify-between mt-4` -> `mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
- `:25` `flex items-center gap-1.5` -> `flex flex-wrap items-center gap-1.5`
- Wrap the controls in `<nav aria-label="Pagination">`; page buttons get `aria-current={p === currentPage ? 'page' : undefined}` and `aria-label={`Page ${p}`}`; Previous/Next keep their text.
- `:40` `w-8 h-8` -> `w-9 h-9`; `:29,:53` add `focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`.
- `:22-24` copy says "tickets": make it a prop (`itemLabel = 'tickets'`) so admin lists can reuse it.

### 6. Tickets pages gutter `px-4 sm:px-6`
Owner: fe-coder1 (files **in flight**), one line each.
- `app/tickets/page.tsx:141` and `app/my-tickets/page.tsx:143`: `max-w-7xl mx-auto px-6 py-6` -> `max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6` (matches `app/dashboard/page.tsx:58`).
- `components/NavBar.tsx:50`: `max-w-7xl mx-auto px-6` -> `max-w-7xl mx-auto px-4 sm:px-6` so the navbar aligns with the page gutter.

## P3 (Low)

### 7. Auth palette as theme tokens (same values, no visual change)
Owner: fe-designer. Add to `tailwind.config.js:9` (`theme.extend`):
```js
colors: {
  auth: {
    ink: '#0F2B32',         // headings, labels, primary button
    'ink-hover': '#123B3E', // button hover, panel gradient end
    brand: '#1F5C57',       // focus border/ring
    accent: '#D9522E',      // required marker, links, errors
    muted: '#7C8B87',
    body: '#4C5C5A',
    mint: '#E4EEE8',        // selected role card
    'err-bg': '#FAECE7',
    'err-border': '#F0997B',
    'err-text': '#993C1D',
    page: '#f9fafb',
  },
},
```
Mechanical replacement (hex tokens keep Tailwind opacity modifiers working: `ring-[#1F5C57]/10` -> `ring-auth-brand/10`):

| Find | Replace |
|---|---|
| `[#0F2B32]` | `auth-ink` |
| `[#123B3E]` | `auth-ink-hover` |
| `[#1F5C57]` | `auth-brand` |
| `[#D9522E]` | `auth-accent` |
| `[#7C8B87]` | `auth-muted` |
| `[#4C5C5A]` | `auth-body` |
| `[#E4EEE8]` | `auth-mint` |
| `[#FAECE7]` / `[#F0997B]` / `[#993C1D]` | `auth-err-bg` / `auth-err-border` / `auth-err-text` |
| `[#f9fafb]` | `auth-page` |

Applies to `components/auth/AuthField.tsx` (5 hits), `AuthShell.tsx` (2; the inline gradient `style` at :17 stays, values unchanged), `LoginForm.tsx` (4), `RegisterForm.tsx` (16). Verify with `grep -rn "\[#" components/auth` returning nothing, then eyeball login and register once.

### 8. Small cleanups
- `components/NavBar.tsx:6` unused `Image` import; `:62` brand `text-sm sm:block` has no matching `hidden`, so drop `sm:block`; delete the commented-out logo block (:55-64) or restore it.
- `components/dashboard/StatCard.tsx:11` unused `color` prop (callers `app/dashboard/page.tsx:81-84`).
- **(in flight)** `components/department-tickets/ActionCell.tsx:17-26` shows "Edit" but calls `onAssign`, and hard-codes user id 1 (also `NavBar.tsx:27`): confirm the intended behaviour against the backend contract before relabelling.
- `components/AssignModal.tsx:79` fixed `h-[600px]`: via `Modal`, `panelClassName="h-[600px] max-h-[90dvh]"`; `AccomplishmentModal.tsx:176` preset grid `grid-cols-3` -> `grid-cols-2 sm:grid-cols-3`.

## Modal migration reminder (fe-coder1, Phase 2)
`AssignModal`, `CommentsModal`, `AccomplishmentModal` move onto `components/ui/Modal` as described in the Modal spec above. That alone resolves the dialog roles, focus trap, Escape, backdrop, scroll-lock and bottom-sheet items from the audit; do not hand-roll them again.
