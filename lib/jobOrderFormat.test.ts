// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'job-order-format'

// The store caches its value in module state, so each test gets a fresh copy.
async function load() {
  vi.resetModules()
  return import('@/lib/jobOrderFormat')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('job order format preference', () => {
  it('defaults to Excel', async () => {
    const f = await load()
    expect(f.DEFAULT_JOB_ORDER_FORMAT).toBe('xlsx')
    expect(f.getJobOrderFormat()).toBe('xlsx')
    expect(f.getServerJobOrderFormat()).toBe('xlsx')
  })

  it('remembers the choice across reloads', async () => {
    let f = await load()
    f.setJobOrderFormat('pdf')
    expect(f.getJobOrderFormat()).toBe('pdf')
    expect(localStorage.getItem(KEY)).toBe('pdf')

    f = await load()
    expect(f.getJobOrderFormat()).toBe('pdf')
  })

  it('ignores a stored value it does not know', async () => {
    localStorage.setItem(KEY, 'docx')
    expect((await load()).getJobOrderFormat()).toBe('xlsx')
  })

  it('notifies subscribers on a change, and stops after unsubscribe', async () => {
    const f = await load()
    const listener = vi.fn()
    const unsubscribe = f.subscribeJobOrderFormat(listener)
    f.setJobOrderFormat('pdf')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    f.setJobOrderFormat('xlsx')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('still works when storage throws (private mode / blocked site data)', async () => {
    const f = await load()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => f.setJobOrderFormat('pdf')).not.toThrow()
    expect(f.getJobOrderFormat()).toBe('pdf')
    expect((await load()).getJobOrderFormat()).toBe('xlsx')
  })

  it('describes each format for the menu and the request', async () => {
    const { JOB_ORDER_FORMATS, isJobOrderFormat } = await load()
    expect(JOB_ORDER_FORMATS.xlsx).toMatchObject({ short: 'Excel', ext: 'xlsx' })
    expect(JOB_ORDER_FORMATS.pdf).toMatchObject({ short: 'PDF', ext: 'pdf', mime: 'application/pdf' })
    expect(isJobOrderFormat('pdf')).toBe(true)
    expect(isJobOrderFormat('docx')).toBe(false)
    expect(isJobOrderFormat(undefined)).toBe(false)
  })
})
