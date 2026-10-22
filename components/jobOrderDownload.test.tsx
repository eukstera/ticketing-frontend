// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  fetchAndSave: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('@/lib/jobOrder', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/jobOrder')>()
  return { ...actual, fetchAndSaveJobOrder: mocks.fetchAndSave }
})
vi.mock('@/components/Toast', () => ({ toast: mocks.toast }))

import { useJobOrderDownload } from '@/hooks/useJobOrderDownload'
import { setJobOrderFormat, type JobOrderFormat } from '@/lib/jobOrderFormat'

let container: HTMLDivElement
let root: Root | null = null
let api: ReturnType<typeof useJobOrderDownload>

function Probe() {
  const value = useJobOrderDownload()
  // Hand the hook's value to the tests from an effect (not during render).
  useEffect(() => {
    api = value
  })
  return null
}

beforeEach(() => {
  localStorage.clear()
  setJobOrderFormat('xlsx')
  mocks.fetchAndSave.mockReset()
  mocks.toast.mockReset()
  mocks.fetchAndSave.mockResolvedValue({ ok: true, filename: 'JO 10-003-26.xlsx' })
  container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    root = createRoot(container)
    root.render(<Probe />)
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
})

const run = (fn: () => Promise<void>) => act(fn)
const requestedFormat = (call = 0) => mocks.fetchAndSave.mock.calls[call][1].format as JobOrderFormat

describe('useJobOrderDownload format', () => {
  it('downloads Excel by default', async () => {
    await run(() => api.download(42, '10-003-2026'))
    expect(requestedFormat()).toBe('xlsx')
    expect(mocks.toast).toHaveBeenCalledWith('Job order (Excel) downloaded for 10-003-2026')
  })

  it('uses the preferred format for the automatic download after Take', async () => {
    act(() => setJobOrderFormat('pdf'))
    await run(() => api.download(42, '10-003-2026', { auto: true }))
    expect(requestedFormat()).toBe('pdf')
    expect(mocks.toast).toHaveBeenCalledWith('Job order (PDF) downloaded for 10-003-2026')
  })

  it('an explicit format from the menu overrides the preference for that one download', async () => {
    await run(() => api.download(42, '10-003-2026', { format: 'pdf' }))
    expect(requestedFormat()).toBe('pdf')
    await run(() => api.download(42, '10-003-2026'))
    expect(requestedFormat(1)).toBe('xlsx')
  })
})

describe('useJobOrderDownload behaviour', () => {
  it('ignores a second request while one is running (no duplicate downloads)', async () => {
    let finish: (v: unknown) => void = () => {}
    mocks.fetchAndSave.mockImplementation(() => new Promise(resolve => (finish = resolve)))

    let first: Promise<void> = Promise.resolve()
    await act(async () => {
      first = api.download(42, '10-003-2026', { auto: true })
      void api.download(42, '10-003-2026') // the manual button during the automatic download
      void api.download(43, '10-004-2026')
    })
    expect(mocks.fetchAndSave).toHaveBeenCalledTimes(1)
    expect(api.busyId).toBe(42)

    await act(async () => {
      finish({ ok: true, filename: 'x.xlsx' })
      await first
    })
    expect(api.busyId).toBeNull()
  })

  it('after a failure the server message is shown, saying the take itself worked when automatic', async () => {
    mocks.fetchAndSave.mockResolvedValue({ ok: false, kind: 'error', message: 'A false-alarm ticket has no job order.' })
    await run(() => api.download(42, '10-003-2026', { auto: true }))
    const [message, type] = mocks.toast.mock.calls[0]
    expect(type).toBe('error')
    expect(message).toContain('Ticket taken')
    expect(message).toContain('A false-alarm ticket has no job order.')
    expect(message).toContain('Download JO')
  })

  it('a manual failure shows just the message', async () => {
    mocks.fetchAndSave.mockResolvedValue({ ok: false, kind: 'blocked', message: 'Your browser blocked the download.' })
    await run(() => api.download(42, '10-003-2026'))
    expect(mocks.toast).toHaveBeenCalledWith('Your browser blocked the download.', 'error', 8000)
  })

  it('stays quiet when the download is aborted', async () => {
    mocks.fetchAndSave.mockResolvedValue({ ok: false, kind: 'aborted' })
    await run(() => api.download(42, '10-003-2026'))
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(api.busyId).toBeNull()
  })

  it('can download again after one finishes', async () => {
    await run(() => api.download(42, '10-003-2026'))
    await run(() => api.download(42, '10-003-2026'))
    expect(mocks.fetchAndSave).toHaveBeenCalledTimes(2)
  })
})
