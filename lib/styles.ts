import { Check, Flag, User, type LucideIcon } from 'lucide-react'

// Single source of truth for status/priority colors used across the app.
// Each status/priority is defined ONCE here with every variant (pill, badge,
// ring, solid bar) it needs. Add a new status/priority by adding one entry;
// every component that reads from this file picks it up automatically.

export interface StatusStyle {
  /** Small rounded label, e.g. table status badge */
  badge: string
  /** Outlined filter pill (FilterPills status row) */
  pill: string
  /** Focus/selected ring color to pair with the pill */
  ring: string
  /** Dashboard stat card (background, border, text, hover) */
  card: string
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  Open: {
    badge: 'bg-blue-100 text-blue-800',
    pill: 'bg-blue-50 text-blue-700 border-blue-300',
    ring: 'ring-blue-400',
    card: 'bg-blue-100 border-blue-200 text-blue-700 hover:bg-blue-200',
  },
  'In-progress': {
    badge: 'bg-amber-100 text-amber-800',
    pill: 'bg-amber-50 text-amber-700 border-amber-300',
    ring: 'ring-amber-400',
    card: 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200',
  },
  Completed: {
    badge: 'bg-green-100 text-green-800',
    pill: 'bg-green-50 text-green-700 border-green-300',
    ring: 'ring-green-400',
    card: 'bg-green-100 border-green-200 text-green-700 hover:bg-green-200',
  },
  Overdue: {
    badge: 'bg-red-100 text-red-800',
    pill: 'bg-red-50 text-red-700 border-red-300',
    ring: 'ring-red-400',
    card: 'bg-red-100 border-red-200 text-red-700 hover:bg-red-200',
  },
}

export const STATUS_FALLBACK: StatusStyle = {
  badge: 'bg-gray-100 text-gray-700',
  pill: 'bg-gray-100 text-gray-700 border-gray-300',
  ring: 'ring-gray-400',
  card: 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200',
}

/** The "All" entry of the status filter row. */
export const STATUS_ALL: StatusStyle = { ...STATUS_FALLBACK }


export interface PriorityStyle {
  /** Plain text color, used next to the priority label in the tickets table */
  text: string
  /** Outlined pill used as the dropdown trigger in FilterPills / priority buttons */
  pill: string
  /** Solid/tinted badge used for counts (dropdown rows + trigger) */
  badge: string
  /** Solid bar color used in the Priority Statistics chart */
  solid: string
  /** Small filled dot / swatch */
  dot: string
  /** Selected ring color */
  ring: string
  highlight: string
}

export const PRIORITY_STYLES: Record<string, PriorityStyle> = {
  'Urgent & IHOMIS Related': {
    text: 'text-red-700',
    pill: 'bg-white text-red-700 border-red-300',
    badge: 'bg-red-600 text-white',
    solid: 'bg-red-500',
    dot: 'bg-red-600',
    ring: 'ring-red-400',
    highlight: 'bg-red-100 border-red-200 text-red-700',
  },
  Urgent: {
    text: 'text-orange-700',
    pill: 'bg-white text-orange-700 border-orange-300',
    badge: 'bg-orange-100 text-orange-700',
    solid: 'bg-orange-500',
    dot: 'bg-orange-600',
    ring: 'ring-orange-400',
    highlight: 'bg-orange-100 border-orange-200 text-orange-700',
  },
  'Important but not urgent': {
    text: 'text-amber-700',
    pill: 'bg-white text-amber-700 border-amber-300',
    badge: 'bg-amber-100 text-amber-700',
    solid: 'bg-amber-400',
    dot: 'bg-amber-500',
    ring: 'ring-amber-400',
    highlight: 'bg-amber-100 border-amber-200 text-amber-700',
  },
  'Long Term': {
    text: 'text-purple-700',
    pill: 'bg-white text-purple-700 border-purple-300',
    badge: 'bg-purple-100 text-purple-700',
    solid: 'bg-purple-400',
    dot: 'bg-purple-500',
    ring: 'ring-purple-400',
    highlight: 'bg-purple-100 border-purple-200 text-purple-700',
  },
  Complex: {
    text: 'text-fuchsia-700',
    pill: 'bg-white text-fuchsia-700 border-fuchsia-300',
    badge: 'bg-fuchsia-100 text-fuchsia-700',
    solid: 'bg-fuchsia-500',
    dot: 'bg-fuchsia-500',
    ring: 'ring-fuchsia-400',
    highlight: 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700',
  },
  Simple: {
    text: 'text-emerald-700',
    pill: 'bg-white text-emerald-700 border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700',
    solid: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-400',
    highlight: 'bg-emerald-100 border-emerald-200 text-emerald-700',
  },
}

export const PRIORITY_FALLBACK: PriorityStyle = {
  text: 'text-gray-600',
  pill: 'bg-white text-gray-700 border-gray-300',
  badge: 'bg-gray-100 text-gray-600',
  solid: 'bg-gray-400',
  dot: 'bg-gray-400',
  ring: 'ring-gray-400',
  highlight: 'bg-gray-100 border-gray-200 text-gray-700',
}

/** Bars for priority levels that have no PRIORITY_STYLES entry, cycled by index. */
export const PRIORITY_SOLID_FALLBACKS = ['bg-blue-500', 'bg-teal-400', 'bg-indigo-400']


export interface TimelineStep {
  match: string
  label: string
  bg: string
  icon: LucideIcon
}

export const fullTimelineSequence: TimelineStep[] = [
  { match: 'Requested', label: 'Requested Date', bg: 'bg-blue-100 text-blue-600', icon: Flag },
  { match: 'Assigned', label: 'Assigned Date', bg: 'bg-amber-100 text-amber-600', icon: User },
  { match: 'Completed', label: 'Completed Date', bg: 'bg-green-100 text-green-600', icon: Check },
]



// START SHARED UI (buttons / inputs)
// Class-string constants for the shared look. Compose with template strings,
// e.g. `${btnPrimary} ${btnSm}`. See docs/DESIGN.md.

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

export const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500`
export const btnSecondary = `${btnBase} border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus-visible:ring-gray-400`
export const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500`
export const btnSuccess = `${btnBase} bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500`
/** Blue-tinted secondary, e.g. the accomplishment-report trigger. */
export const btnTint = `${btnBase} border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-500`
/**
 * Size modifier for table-row / inline actions; append after a btn* constant.
 * The `!` is required: btnBase already sets px-4 py-2 text-sm, and Tailwind
 * resolves same-property conflicts by stylesheet order, not class order.
 */
export const btnSm = '!px-3 !py-1.5 !text-xs'

export const input =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-500'
/** `input` at its natural width (date/select/inline filters). `input` + `w-auto` does not work: w-full sorts after w-auto. */
export const inputAuto = input.replace('w-full', 'w-auto')
/** Append to `input` when the field has a validation error. */
export const inputError = 'border-red-400 focus:border-red-500 focus:ring-red-500/30'

// END SHARED UI
