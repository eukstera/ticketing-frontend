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
`btnPrimary`, `btnSecondary`, `btnDanger`, `btnSuccess` (all `rounded-lg px-4 py-2 text-sm font-medium` with `focus-visible:ring-2`), `btnTint` (blue-tinted secondary), `btnSm` (size modifier, uses `!` so it overrides the base size), `input` (full-width, `focus:ring-2 ring-blue-500/30`), `inputAuto` (same at natural width), `inputError` (append to `input`), `fieldClass(hasError)` from `ui/Field`.
Usage: `className={`${btnPrimary} ${btnSm}`}`.

### `components/ui/*`
- `Modal` `{ isOpen, onClose, title?, ariaLabel?, size?: 'sm'|'md'|'lg', footer?, closeOnBackdrop?, bodyClassName?, panelClassName?, children }`. `role="dialog"`, `aria-modal`, `aria-labelledby` (title), focus trap + restore, Escape, backdrop mousedown closes, body scroll lock, bottom sheet below `sm`. Pass `ariaLabel` when there is no `title`. Set `closeOnBackdrop={false}` while saving.
- `Skeleton`, `TableSkeleton { rows?, columns? }`, `CardSkeleton { lines?, className? }`.
- `EmptyState { icon?, title, description?, action?: { label, onClick } | { label, href }, className? }`.
- `Field { id?, label, icon?, required?, hint?, error?, className?, *ClassName overrides, children: (control) => node }` and `FieldGroup` (same, for a `role="group"` of buttons/inputs). The child spreads `control` (`id`, `required`, `aria-invalid`, `aria-describedby`) onto its `<input>/<select>/<textarea>`; the error is `role="alert"`. Use these for every form field.
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

# Polish log (Phases 1-3): done and open

Status after the final polish batch. Everything below is committed on `main`; `npx tsc --noEmit`, eslint and `npm test` were green at each commit. Not covered by any automated check: real-browser behaviour, a screen-reader pass, and an axe/Lighthouse run (`next build` is intentionally never run; see "Accepted exceptions"). Treat the a11y items as "implemented per the ARIA patterns", not "verified with assistive tech".

## Done (with commits)

| Area | What changed | Commits |
|---|---|---|
| Shared UI | `Modal` (dialog roles, focus trap/restore, Escape, backdrop, scroll lock, bottom sheet, topmost-modal-only keys), `Skeleton`, `EmptyState` (+ `action.href`), `ErrorState`, `Avatar`; `btn*`/`input` constants; `btnSm` fixed with `!` modifiers; `btnTint`, `inputAuto` | 5425364, e90f0f7, c3f4de4, 5511da5 |
| Modals/toasts | ConfirmModal on `Modal` (+`error`), Toast live region/dismiss/pause, Assign/Accomplishment/Comments on `Modal` (CommentsModal now renders `CommentThread`) | c1aca12, f60861a, e3400e9, d0fa529, c3f4de4 |
| Nav | `aria-current`, focus rings, hamburger expanded/controls (lucide), Escape + focus return, "My profile", gutters, contrast; skip link in the layout; `<main id="main">` on every page/shell | d77c0fc, 8a45ef8, 5c5b71e, 8885403 |
| Lists | Table cards below `md`, `Pagination` as a labelled nav with `aria-current`, wrap, 36px targets; `FilterPills` group/listbox with keyboard model; empty/404/error states; `px-4 sm:px-6` | f6a9052, 8a45ef8, 5a176d0, 6e8fd44, 897f1af |
| Dashboard | empty-data states (no 0% for an empty day, empty priority chart message), `h2` headings, month label, focus rings, hidden empty pill row | 31d6ac9 |
| Forms | `ui/Field` + `FieldGroup` (label/hint/error/id wiring, tested) used by `AuthField`, profile, `AdminFormModal`, create-ticket; create-ticket 422 mapper (`lib/createTicketErrors.ts`, tested): keys with a control show inline and focus the first one in form order, keys without one (e.g. `service_department`) go to the form banner | 4f59e58, ce4b010, 8ea77d9, 4907e55, fba9742, d177066, d236f1c |
| Auth | login labels/`aria-invalid`/`role="alert"`/autocomplete, keyboard-reachable password toggle; palette moved to `theme.extend.colors.auth.*` with identical values (verified by comparing the compiled CSS) | 0d35a17, 72df7b1 |
| Styles | legacy status/priority maps deleted; `STATUS_STYLES`/`PRIORITY_STYLES` are the only source; `formatDateTime`/`formatDateTimeText` live in `lib/format.ts`; timeline icons are lucide | 1d2ea9d, 906eed1, 02d2a3a, c5a9e12, 5d4d2f3 |
| Misc a11y | `CommentButton` names the ticket and count (40px), `TimelineStepper` stacks on mobile with accessible contrast (the invalid `w-25` is gone) | 8932d9f, a85bf99, a8dfb28 |

### Deliberate visual changes (everything else keeps the original look)
- Dashboard Priority Statistics: the **Complex** bar is `bg-fuchsia-500` (was `purple-500`), matching every other Complex variant. (906eed1)
- Create-ticket priority cards: the selected card's `highlight` now carries a matching `text-*-700` colour for every priority (previously only the first had one), and an **unknown priority falls back to gray** instead of Complex's fuchsia. (11ed7b5)
- Comments modal: the add-comment form scrolls with the list instead of being pinned to the bottom (it now shares `CommentThread` with the ticket detail page). (c3f4de4)
- Small size/contrast bumps: `CommentButton` 24px -> 40px, gray-400 text -> gray-500, mobile gutters, small buttons now really render small (`btnSm`).

### Decisions worth keeping
- **Admin status pills stay solid blue** when selected, while ticket `FilterPills` use tinted pills with a ring. The admin filter is a single binary choice (all / active / inactive) where a strong selected state reads best; ticket filters are categories whose colour carries meaning (status/priority), so they keep their own hues.
- **Tailwind class conflicts are resolved by stylesheet order, not class order.** Never combine two same-property utilities in one string (`px-4` + `px-3`, `w-full` + `w-auto`, `text-sm` + `text-xs`) and expect the later one to win. Use `!` modifiers (`btnSm`) or a dedicated constant (`inputAuto`, `btnTint`).
- **Disclosure vs menu**: the account menu and priority dropdown follow the menu/listbox keyboard patterns; if either grows beyond a couple of items, add Home/End/typeahead.

### Consolidation page (`/reports/consolidated`, Encoder + Department Head, own department only)
Built from existing pieces; no new look and no chart library. Commits e1101cc, e69994a, 60e3c39.
- **Filters** edit a *draft* and only Apply writes the URL (`basis, from, to, area, status, priority, type, staff, page`; comma lists, ids except `area`). The panel remounts (`key`) when the applied filters change, so the draft never drifts. Phone: a "Filters (n)" toggle with `aria-expanded`. Exports and chips always use the *applied* filters; an amber hint shows when the draft differs.
- **`ui/MultiSelect`** (generic): FilterPills' dropdown pattern as a multi-choice listbox (`aria-multiselectable`, arrow/Home/End, Escape returns focus to the trigger, Tab closes). Trigger reads "All" / the name / "N selected"; a search box appears above 8 options (`SEARCH_THRESHOLD`). Status and priority options carry their `STATUS_STYLES`/`PRIORITY_STYLES` colours via `chipClass`. Reuse it for any new multi-filter.
- **KPI tiles** are a `<dl>` of static tiles with StatCard's shell (hover classes stripped). Valid markup needs `dt`, then `dd`: the DOM order is label, value, caption, and `order-1/2/3` on a `flex flex-col` tile shows value, label, caption. Don't use `flex-col-reverse` (it would put the caption on top). `null` renders "—" plus sr-only "No data".
- **Breakdown bars** are plain divs (`role="img"` + a label that lists the numbers). Colours come from `STATUS_STYLES[x].solid` / `PRIORITY_STYLES[x].solid`; add a new status once in `lib/styles.ts`.
- **Preview table** follows the admin table: `overflow-x-auto`, `min-w-[960px]`, sr-only caption, no card layout on phones. The **Ticket no. column is sticky** (`sticky left-0`, `border-r`); because a sticky cell needs its own background, the row is a `group` and the cell uses `group-hover:bg-gray-50` so hover stays uniform. A page change dims rows, tiles and breakdowns (`opacity-60`, `aria-busy`) rather than swapping in skeletons.
- **Export** (`useConsolidatedExport`): one at a time (ref guard), aborts on unmount, "Exporting…" then "Still working…" after 5 s, announced through an sr-only `role="status"`; disabled with a stated reason when nothing matches.
- Durations use `formatDuration` (`lib/format.ts`): "2d 4h", "5h 30m", "<1m", "—".
- Not yet checked visually at phone width (Filters toggle, sticky column, dropdown near the bottom of the panel).

## Open (none blocks release)
1. **Admin tables on phones.** They scroll horizontally (`min-w-[640px]`) rather than stacking into cards like the ticket list. Acceptable for an admin tool; reuse the ticket card pattern if that changes.
2. **Page titles.** Only the ticket detail and Consolidation pages set `document.title`; the other client pages share the layout title.
3. **Account menu keys.** It has `role="menu"` with Escape and focus management but no arrow-key navigation (it holds two items). Add arrows if items are added.
4. **Verification gap.** Run a keyboard-only pass and one screen reader (NVDA/VoiceOver) over login, ticket list, ticket detail, create-ticket, profile and an admin list/form, and run axe on the same pages. (`next build` is deliberately not part of this work; see the exception note below.)

## Accepted exceptions
- **Auth error / required-marker text contrast.** The login screens' error and required-marker text uses `#D9522E` on white, about 3.9:1 at 12px, below the 4.5:1 WCAG AA target for small text. This is a **known exception accepted by the user on 2026-10-21**: the accent colour stays as is, so `auth.accent` keeps `#D9522E` and the auth screens stay pixel-identical. (Decision relayed by the orchestrator session.) Error text is still conveyed with a `role="alert"` message, not by colour alone. Revisit only if the accent is ever redesigned.
- **No `next build`.** The user's instruction for this effort is that `next build` is never run; verification is `npx tsc --noEmit`, eslint and `npm test` only.
