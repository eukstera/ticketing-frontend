import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadAccomplishmentReport, markFalseAlarm } from '@/lib/tickets'

const fetchMock = vi.fn()

function docxResponse() {
  return new Response('docx', {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="Cruz Oct 1-15 Report.docx"' },
  })
}

function requestedParams() {
  const url = new URL(fetchMock.mock.calls[0][0] as string)
  return url.searchParams
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(docxResponse())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('downloadAccomplishmentReport signatory params', () => {
  it('sends no signatory params by default so the BE uses the saved default', async () => {
    await downloadAccomplishmentReport('2026-10-01', '2026-10-15')
    const p = requestedParams()
    expect(p.get('date_from')).toBe('2026-10-01')
    expect(p.has('signatory_id')).toBe(false)
    expect(p.has('signatory_name')).toBe(false)
    expect(p.has('signatory_title')).toBe(false)
  })

  it('sends signatory_id for a saved signatory', async () => {
    await downloadAccomplishmentReport('2026-10-01', '2026-10-15', undefined, undefined, { id: 7 })
    const p = requestedParams()
    expect(p.get('signatory_id')).toBe('7')
    expect(p.has('signatory_name')).toBe(false)
  })

  it('sends signatory_name and signatory_title together for a one-off signatory', async () => {
    await downloadAccomplishmentReport('2026-10-01', '2026-10-15', undefined, undefined, {
      name: 'Ana Reyes & Co',
      title: 'IT Manager',
    })
    const p = requestedParams()
    expect(p.get('signatory_name')).toBe('Ana Reyes & Co')
    expect(p.get('signatory_title')).toBe('IT Manager')
    expect(p.has('signatory_id')).toBe(false)
  })

  it('uses the server filename, with a generic fallback when the header is stripped', async () => {
    const withHeader = await downloadAccomplishmentReport('2026-10-01', '2026-10-15')
    expect(withHeader.filename).toBe('Cruz Oct 1-15 Report.docx')

    fetchMock.mockResolvedValue(new Response('docx', { status: 200 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const without = await downloadAccomplishmentReport('2026-10-01', '2026-10-15')
    expect(without.filename).toBe('accomplishment-report_2026-10-01_2026-10-15.docx')
  })

  it('surfaces the JSON error message from a 422', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'The signatory is invalid.' }), {
        status: 422,
      })
    )
    await expect(
      downloadAccomplishmentReport('2026-10-01', '2026-10-15', undefined, undefined, { id: 9 })
    ).rejects.toMatchObject({ status: 422, message: 'The signatory is invalid.' })
  })
})

describe('markFalseAlarm', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('POSTs the trimmed reason to the ticket false-alarm route', async () => {
    fetchMock.mockResolvedValue(
      json({
        success: true,
        message: 'Ticket marked as false alarm',
        result: { false_alarm: { reason: 'Duplicate', marked_by: { id: 1, first_name: 'A', last_name: 'B' }, marked_at: '' } },
      })
    )
    const res = await markFalseAlarm(42, '  Duplicate request  ')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).pathname).toBe('/api/tickets/42/false-alarm')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'Duplicate request' })
    expect(res.result.false_alarm.reason).toBe('Duplicate')
  })

  it('surfaces the 422 reason error', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Invalid', errors: { reason: ['The reason must be at least 3 characters.'] } }, 422)
    )
    await expect(markFalseAlarm(42, 'ab')).rejects.toMatchObject({
      status: 422,
      errors: { reason: ['The reason must be at least 3 characters.'] },
    })
  })

  it('surfaces the 409 message when the ticket was already taken or rejected', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Only untaken open tickets can be marked as a false alarm.' }, 409)
    )
    await expect(markFalseAlarm(42, 'Duplicate')).rejects.toMatchObject({
      status: 409,
      message: 'Only untaken open tickets can be marked as a false alarm.',
    })
  })

  it('surfaces the 403 message for other departments', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: false, message: 'Only members of the handling department can mark a ticket as a false alarm.' }, 403)
    )
    await expect(markFalseAlarm(42, 'Duplicate')).rejects.toMatchObject({ status: 403 })
  })
})
