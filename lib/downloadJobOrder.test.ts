import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadJobOrder } from '@/lib/tickets'

const fetchMock = vi.fn()
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PDF = 'application/pdf'

function xlsx(headers: Record<string, string> = {}) {
  return new Response('xlsx-bytes', { status: 200, headers: { 'Content-Type': XLSX, ...headers } })
}
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('downloadJobOrder', () => {
  it('GETs the ticket job-order route asking for Excel by default, with the format sent explicitly', async () => {
    fetchMock.mockResolvedValue(xlsx({ 'Content-Disposition': 'attachment; filename="JO 10-003-26.xlsx"' }))
    await downloadJobOrder(42, undefined, '10-003-2026')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/api/tickets/42/job-order')
    expect(parsed.search).toBe('?format=xlsx')
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>).Accept).toBe(XLSX)
  })

  it('asks for a PDF explicitly, with the PDF Accept header', async () => {
    fetchMock.mockResolvedValue(
      new Response('pdf-bytes', {
        status: 200,
        headers: { 'Content-Type': PDF, 'Content-Disposition': 'attachment; filename="JO 10-003-26.pdf"' },
      })
    )
    const res = await downloadJobOrder(42, undefined, '10-003-2026', 'pdf')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).search).toBe('?format=pdf')
    expect((init.headers as Record<string, string>).Accept).toBe(PDF)
    expect(res.filename).toBe('JO 10-003-26.pdf')
    expect(await res.blob.text()).toBe('pdf-bytes')
  })

  it('uses the filename and extension from Content-Disposition', async () => {
    fetchMock.mockResolvedValue(xlsx({ 'Content-Disposition': 'attachment; filename="JO 10-003-26.xlsx"' }))
    const res = await downloadJobOrder(42, undefined, '10-003-2026')
    expect(res.filename).toBe('JO 10-003-26.xlsx')
    expect(await res.blob.text()).toBe('xlsx-bytes')
  })

  it('reads an RFC 5987 filename too', async () => {
    fetchMock.mockResolvedValue(xlsx({ 'Content-Disposition': "attachment; filename*=UTF-8''JO%2010-003-26.xlsx" }))
    expect((await downloadJobOrder(42)).filename).toBe('JO 10-003-26.xlsx')
  })

  it('falls back to "JO <ticket number>.xlsx" when a proxy strips the header', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // a Response body can only be read once, so build a fresh one per call
    fetchMock.mockImplementation(async () => xlsx())
    expect((await downloadJobOrder(42, undefined, '10-003-2026')).filename).toBe('JO 10-003-2026.xlsx')
    expect((await downloadJobOrder(42)).filename).toBe('JO 42.xlsx')
    expect((await downloadJobOrder(42, undefined, '10-003-2026', 'pdf')).filename).toBe('JO 10-003-2026.pdf')
    expect(warn).toHaveBeenCalled()
  })

  it.each([
    [403, 'Only members of the handling department can download a job order.'],
    [409, 'A false-alarm ticket has no job order.'],
    [409, 'Job order forms are only available for IT tickets.'],
    [404, 'Ticket not found.'],
  ])('surfaces the %i JSON error "%s" even though success is a blob', async (status, message) => {
    fetchMock.mockImplementation(async () => json({ success: false, message }, status))
    await expect(downloadJobOrder(42)).rejects.toMatchObject({ status, message })
  })

  it('surfaces the 422 for an unknown format', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'The selected format is invalid.', errors: { format: ['The selected format is invalid.'] } }, 422)
    )
    await expect(downloadJobOrder(42, undefined, undefined, 'pdf')).rejects.toMatchObject({
      status: 422,
      errors: { format: ['The selected format is invalid.'] },
    })
  })

  it('reports a 500 as a failure', async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: 'Failed to generate the job order.' }, 500))
    await expect(downloadJobOrder(42)).rejects.toMatchObject({ status: 500 })
  })

  it('passes the abort signal to the request', async () => {
    fetchMock.mockResolvedValue(xlsx())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ctrl = new AbortController()
    await downloadJobOrder(42, ctrl.signal)
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(ctrl.signal)
  })
})
