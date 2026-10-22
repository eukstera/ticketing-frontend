import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import type { AuthUser } from '@/lib/auth'
import {
  BLOCKED_MESSAGE,
  canDownloadJobOrder,
  fetchAndSaveJobOrder,
  takeThenJobOrder,
  type JobOrderDeps,
} from '@/lib/jobOrder'

const staff = (over: Partial<AuthUser> = {}) => ({ id: 7, department_id: 1, ...over }) as AuthUser
const head = (departmentId = 2) => staff({ department_id: departmentId, role: { id: 1, name: 'Department Head' } })

describe('canDownloadJobOrder', () => {
  const it1 = (status: string, department_id = 1) => ({ status, department_id })

  it.each(['Open', 'In-progress', 'Overdue', 'Pending Confirmation', 'Completed'])('is offered on an IT %s ticket to its department staff', status => {
    expect(canDownloadJobOrder(it1(status), staff())).toBe(true)
  })

  it.each(['Open', 'In-progress', 'Overdue', 'Pending Confirmation', 'Completed'])('is offered on an IT %s ticket to a Department Head of any department', status => {
    expect(canDownloadJobOrder(it1(status), head(2))).toBe(true)
    expect(canDownloadJobOrder(it1(status), head(1))).toBe(true)
  })

  it('is hidden on a False Alarm ticket for everyone', () => {
    expect(canDownloadJobOrder(it1('False Alarm'), staff())).toBe(false)
    expect(canDownloadJobOrder(it1('False Alarm'), head())).toBe(false)
  })

  it('is hidden on Engineering tickets (IT form only), even for a head or its own staff', () => {
    expect(canDownloadJobOrder(it1('Open', 2), staff({ department_id: 2 }))).toBe(false)
    expect(canDownloadJobOrder(it1('Open', 2), head(2))).toBe(false)
  })

  it('is hidden from staff of other departments, plain users and signed-out visitors', () => {
    expect(canDownloadJobOrder(it1('Open'), staff({ department_id: 3 }))).toBe(false)
    expect(canDownloadJobOrder(it1('Open'), null)).toBe(false)
    expect(canDownloadJobOrder(it1('Open'), undefined)).toBe(false)
  })

  it('is hidden for an unknown status', () => {
    expect(canDownloadJobOrder(it1('Something New'), staff())).toBe(false)
  })
})

describe('fetchAndSaveJobOrder', () => {
  const blob = new Blob(['xlsx'])
  const deps = (over: Partial<JobOrderDeps> = {}): JobOrderDeps => ({
    fetchFile: vi.fn(async () => ({ blob, filename: 'JO 10-003-26.xlsx' })),
    save: vi.fn(() => true),
    ...over,
  })

  it('fetches the file and saves it under the server filename', async () => {
    const d = deps()
    const ctrl = new AbortController()
    const res = await fetchAndSaveJobOrder(42, { ticketNumber: '10-003-2026', signal: ctrl.signal }, d)
    expect(res).toEqual({ ok: true, filename: 'JO 10-003-26.xlsx' })
    expect(d.fetchFile).toHaveBeenCalledWith(42, ctrl.signal, '10-003-2026', undefined)
    expect(d.save).toHaveBeenCalledWith(blob, 'JO 10-003-26.xlsx')
  })

  it('asks for the chosen format and saves the file the server names (extension and all)', async () => {
    const pdf = new Blob(['pdf'])
    const d = deps({ fetchFile: vi.fn(async () => ({ blob: pdf, filename: 'JO 10-003-26.pdf' })) })
    const res = await fetchAndSaveJobOrder(42, { ticketNumber: '10-003-2026', format: 'pdf' }, d)
    expect(res).toEqual({ ok: true, filename: 'JO 10-003-26.pdf' })
    expect(d.fetchFile).toHaveBeenCalledWith(42, undefined, '10-003-2026', 'pdf')
    expect(d.save).toHaveBeenCalledWith(pdf, 'JO 10-003-26.pdf')
  })

  it('reports the server message and saves nothing when generation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({
      fetchFile: vi.fn(async () => {
        throw new ApiError(409, 'A false-alarm ticket has no job order.')
      }),
    })
    const res = await fetchAndSaveJobOrder(42, {}, d)
    expect(res).toEqual({ ok: false, kind: 'error', message: 'A false-alarm ticket has no job order.' })
    expect(d.save).not.toHaveBeenCalled()
  })

  it('uses friendly copy for a 500 or a network failure, never raw server text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const server = await fetchAndSaveJobOrder(
      42,
      {},
      deps({ fetchFile: vi.fn(async () => { throw new ApiError(500, 'SQLSTATE[HY000] stack trace') }) })
    )
    expect(server).toMatchObject({ ok: false, kind: 'error' })
    expect((server as { message: string }).message).not.toMatch(/SQLSTATE/)

    const offline = await fetchAndSaveJobOrder(
      42,
      {},
      deps({ fetchFile: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    )
    expect(offline).toMatchObject({ ok: false, kind: 'error' })
  })

  it('surfaces the 422 for an unknown format', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = deps({
      fetchFile: vi.fn(async () => {
        throw new ApiError(422, 'The selected format is invalid.', { format: ['The selected format is invalid.'] })
      }),
    })
    const res = await fetchAndSaveJobOrder(42, { format: 'pdf' }, d)
    expect(res).toMatchObject({ ok: false, kind: 'error', message: 'The selected format is invalid.' })
    expect(d.save).not.toHaveBeenCalled()
  })

  it('says so when the browser blocks the download, so the user can use Download JO', async () => {
    const res = await fetchAndSaveJobOrder(42, {}, deps({ save: vi.fn(() => false) }))
    expect(res).toEqual({ ok: false, kind: 'blocked', message: BLOCKED_MESSAGE })
    expect(BLOCKED_MESSAGE).toMatch(/Download JO/)
  })

  it('treats an abort as neither success nor error', async () => {
    const d = deps({
      fetchFile: vi.fn(async () => {
        throw new DOMException('aborted', 'AbortError')
      }),
    })
    expect(await fetchAndSaveJobOrder(42, {}, d)).toEqual({ ok: false, kind: 'aborted' })
    expect(d.save).not.toHaveBeenCalled()
  })
})

describe('takeThenJobOrder', () => {
  const order: string[] = []
  const make = (over: Partial<Parameters<typeof takeThenJobOrder>[2]> = {}) => {
    order.length = 0
    return {
      take: vi.fn(async () => {
        order.push('take')
      }),
      onTaken: vi.fn(() => {
        order.push('onTaken')
      }),
      downloadJobOrder: vi.fn(async () => {
        order.push('download')
      }),
      ...over,
    }
  }

  it('takes first, announces it, and only then downloads the job order', async () => {
    const deps = make()
    expect(await takeThenJobOrder(42, 7, deps)).toEqual({ taken: true })
    expect(deps.take).toHaveBeenCalledWith(42, 7)
    expect(deps.downloadJobOrder).toHaveBeenCalledWith(42)
    expect(order).toEqual(['take', 'onTaken', 'download'])
  })

  it('does not request a job order when the take fails', async () => {
    const error = new ApiError(409, "This ticket's status changed, refresh and try again.")
    const deps = make({
      take: vi.fn(async () => {
        throw error
      }),
    })
    expect(await takeThenJobOrder(42, 7, deps)).toEqual({ taken: false, error })
    expect(deps.onTaken).not.toHaveBeenCalled()
    expect(deps.downloadJobOrder).not.toHaveBeenCalled()
  })

  it('a failing job order never undoes or hides the successful take', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = make({
      downloadJobOrder: vi.fn(async () => {
        throw new Error('generation failed')
      }),
    })
    expect(await takeThenJobOrder(42, 7, deps)).toEqual({ taken: true })
    expect(deps.onTaken).toHaveBeenCalledTimes(1)
  })

  it('still downloads if announcing the take throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = make({
      onTaken: vi.fn(() => {
        throw new Error('toast broke')
      }),
    })
    expect(await takeThenJobOrder(42, 7, deps)).toEqual({ taken: true })
    expect(deps.downloadJobOrder).toHaveBeenCalledTimes(1)
  })
})
