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
