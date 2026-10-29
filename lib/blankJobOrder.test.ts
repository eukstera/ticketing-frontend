import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/lib/auth'
import {
  VOID_REASON_MAX,
  canFillBlank,
  canPrintBlank,
  canReprintBlank,
  canVoid,
  printBlankJobOrder,
  validateVoidReason,
} from '@/lib/blankJobOrder'
import { canMarkFalseAlarm } from '@/lib/falseAlarm'
import { reservedMessage, reservedNotDownloadedMessage } from '@/lib/blankMessages'

const user = (over: Partial<AuthUser> = {}) =>
  ({ id: 7, department_id: 1, role: { id: 2, name: 'Normal User' }, ...over }) as AuthUser
const head = (departmentId = 1) => user({ department_id: departmentId, role: { id: 1, name: 'Department Head' } })
const encoder = user({ role: { id: 4, name: 'Encoder' } })
const blank = { status: 'Blank', department_id: 1 }

describe('canPrintBlank', () => {
  it('is for IT staff and IT heads only', () => {
    expect(canPrintBlank(user())).toBe(true)
    expect(canPrintBlank(head())).toBe(true)
  })

  it('is hidden from other departments (heads too), encoders and signed-out visitors', () => {
    expect(canPrintBlank(user({ department_id: 2 }))).toBe(false)
    expect(canPrintBlank(head(2))).toBe(false)
    expect(canPrintBlank(encoder)).toBe(false)
    expect(canPrintBlank(null)).toBe(false)
  })
})

describe.each([
  ['canFillBlank', canFillBlank],
  ['canReprintBlank', canReprintBlank],
  ['canVoid', canVoid],
])('%s', (_name, predicate) => {
  it('is true for heads of the ticket department, and for staff only where they may work on it', () => {
    expect(predicate(blank, head())).toBe(true)
    expect(predicate(blank, user())).toBe(_name === 'canReprintBlank')
  })

  it('is false for encoders, other-department staff, and signed-out visitors', () => {
    expect(predicate(blank, encoder)).toBe(false)
    expect(predicate(blank, user({ department_id: 2 }))).toBe(false)
    expect(predicate(blank, null)).toBe(false)
  })

  it.each(['Open', 'In-progress', 'Void', 'False Alarm', 'Completed'])('is false on a %s ticket', status => {
    expect(predicate({ ...blank, status }, user())).toBe(false)
    expect(predicate({ ...blank, status }, head())).toBe(false)
  })
})

describe('canMarkFalseAlarm on Blank tickets', () => {
  it('is offered to heads, not encoders (the owner case is covered below)', () => {
    const t = { ...blank, assigned_activity: null }
    expect(canMarkFalseAlarm(t, head(2))).toBe(true)
    expect(canMarkFalseAlarm(t, encoder)).toBe(false)
  })
})

describe('validateVoidReason', () => {
  it('requires 5 to 255 trimmed characters', () => {
    expect(validateVoidReason('')).toBe('Enter a reason.')
    expect(validateVoidReason('  abcd  ')).toBe('The reason must be at least 5 characters.')
    expect(validateVoidReason('abcde')).toBeNull()
    expect(validateVoidReason('x'.repeat(VOID_REASON_MAX))).toBeNull()
    expect(validateVoidReason('x'.repeat(VOID_REASON_MAX + 1))).toBe('The reason must be at most 255 characters.')
  })
})

describe('printBlankJobOrder', () => {
  const ticket = { id: 9, ticket_number: '10-045-2026' }

  it('reserves, then downloads, and reports success', async () => {
    const download = vi.fn().mockResolvedValue({ ok: true })
    const res = await printBlankJobOrder({ reserve: async () => ticket, download })
    expect(res).toEqual({ reserved: true, ticket, saved: true })
    expect(download).toHaveBeenCalledWith(ticket)
  })

  it('keeps the reserved number when the download fails (partial failure)', async () => {
    const res = await printBlankJobOrder({
      reserve: async () => ticket,
      download: async () => ({ ok: false, message: 'Blocked' }),
    })
    expect(res).toEqual({ reserved: true, ticket, saved: false, message: 'Blocked' })
  })

  it('treats a throwing download as a partial failure too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await printBlankJobOrder({
      reserve: async () => ticket,
      download: async () => {
        throw new Error('boom')
      },
    })
    expect(res.reserved && !res.saved).toBe(true)
  })

  it('never downloads when the reserve fails', async () => {
    const download = vi.fn()
    const error = new Error('403')
    const res = await printBlankJobOrder({
      reserve: async () => {
        throw error
      },
      download,
    })
    expect(res).toEqual({ reserved: false, error })
    expect(download).not.toHaveBeenCalled()
  })
})

describe('print messages', () => {
  it('name the number the API returned', () => {
    expect(reservedMessage('10-045-2026')).toBe('Ticket number 10-045-2026 reserved. Blank job order downloaded.')
    expect(reservedNotDownloadedMessage('10-045-2026')).toBe(
      `Ticket number 10-045-2026 was reserved, but the PDF wasn't downloaded. Use "Reprint JO" on that row.`
    )
  })
})

describe('Blank ticket ownership', () => {
  const owned = { ...blank, assigned_activity: { id: 1, created_at: '', user: 'Eve', user_id: 7 } }
  const owner = user({ id: 7 })
  const other = user({ id: 8 })

  it.each([
    ['canFillBlank', canFillBlank],
    ['canVoid', canVoid],
  ])('%s: the owner and heads yes, other staff and encoders no', (_n, predicate) => {
    expect(predicate(owned, owner)).toBe(true)
    expect(predicate(owned, head())).toBe(true)
    expect(predicate(owned, other)).toBe(false)
    expect(predicate(owned, user({ id: 7, role: { id: 4, name: 'Encoder' } }))).toBe(false)
  })

  it('false alarm on a Blank ticket: the owner and heads yes, other staff no', () => {
    const t = { ...owned, assigned_activity: owned.assigned_activity }
    expect(canMarkFalseAlarm(t, owner)).toBe(true)
    expect(canMarkFalseAlarm(t, head(2))).toBe(true)
    expect(canMarkFalseAlarm(t, other)).toBe(false)
  })

  it('reprint stays open to any staff of the department', () => {
    expect(canReprintBlank(owned, other)).toBe(true)
    expect(canReprintBlank(owned, user({ department_id: 2 }))).toBe(false)
  })

  it('accepts owner_id (a detail page) as well as assigned_activity (a list row)', () => {
    const detail = { ...blank, owner_id: 7 }
    expect(canFillBlank(detail, owner)).toBe(true)
    expect(canFillBlank(detail, other)).toBe(false)
    expect(canFillBlank({ ...blank, owner_id: null }, other)).toBe(false)
  })
})
