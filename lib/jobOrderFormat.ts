// Which file a job order is downloaded as. The choice for the automatic
// download after Take (and the main "Download JO" click) is remembered per
// browser; the menu can still fetch the other format for a single download.

export type JobOrderFormat = 'xlsx' | 'pdf'

export const JOB_ORDER_FORMATS: Record<JobOrderFormat, { label: string; short: string; mime: string; ext: string }> = {
  xlsx: {
    label: 'Excel (.xlsx)',
    short: 'Excel',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  },
  pdf: { label: 'PDF', short: 'PDF', mime: 'application/pdf', ext: 'pdf' },
}

export const DEFAULT_JOB_ORDER_FORMAT: JobOrderFormat = 'xlsx'
const STORAGE_KEY = 'job-order-format'

export function isJobOrderFormat(value: unknown): value is JobOrderFormat {
  return value === 'xlsx' || value === 'pdf'
}

const listeners = new Set<() => void>()
let current: JobOrderFormat | null = null

// localStorage can throw (private mode, blocked site data): fall back to the default.
function read(): JobOrderFormat {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isJobOrderFormat(stored) ? stored : DEFAULT_JOB_ORDER_FORMAT
  } catch {
    return DEFAULT_JOB_ORDER_FORMAT
  }
}

export function getJobOrderFormat(): JobOrderFormat {
  if (current === null) current = read()
  return current
}

export function getServerJobOrderFormat(): JobOrderFormat {
  return DEFAULT_JOB_ORDER_FORMAT
}

export function setJobOrderFormat(next: JobOrderFormat) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Not persisted; the choice still holds for this page load.
  }
  listeners.forEach(l => l())
}

export function subscribeJobOrderFormat(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}
