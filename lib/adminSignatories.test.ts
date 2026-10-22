import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdmin, deactivateAdmin, listAdmin, reactivateAdmin, updateAdmin } from '@/lib/admin'
import { getAdminResource } from '@/lib/adminResources'
import { getErrorMessage, type ApiError } from '@/lib/api'

const fetchMock = vi.fn()
const { endpoint, listKey } = getAdminResource('report-signatories')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url: new URL(url), init }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('report signatory admin requests', () => {
  it('lists with search, status and pagination under result.signatories', async () => {
    fetchMock.mockResolvedValue(
      json({
        success: true,
        result: {
          signatories: { data: [{ id: 1, name: 'Ana' }], current_page: 2, last_page: 3, per_page: 15, total: 31 },
        },
      })
    )
    const page = await listAdmin(endpoint, listKey, { page: 2, per_page: 15, search: 'an', status: 'inactive' })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/admin/report-signatories')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      per_page: '15',
      search: 'an',
      status: 'inactive',
    })
    expect(init.method).toBe('GET')
    expect(page).toMatchObject({ current_page: 2, last_page: 3, total: 31, data: [{ id: 1, name: 'Ana' }] })
  })

  it('creates with POST', async () => {
    fetchMock.mockResolvedValue(json({ success: true, result: { signatory: { id: 5 } } }, 201))
    await createAdmin(endpoint, { name: 'Ana', title: 'Manager' })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/admin/report-signatories')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Ana', title: 'Manager' })
  })

  it('sets the default with PATCH { is_default: true }', async () => {
    fetchMock.mockResolvedValue(json({ success: true, result: {} }))
    await updateAdmin(endpoint, 4, { is_default: true })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/api/admin/report-signatories/4')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ is_default: true })
  })

  it('deactivates with DELETE and reactivates with PATCH { status: true }', async () => {
    // a Response body can only be read once, so build a fresh one per call
    fetchMock.mockImplementation(async () => json({ success: true, result: {} }))
    await deactivateAdmin(endpoint, 4)
    expect(lastCall().init.method).toBe('DELETE')
    expect(lastCall().url.pathname).toBe('/api/admin/report-signatories/4')

    await reactivateAdmin(endpoint, 4)
    expect(lastCall().init.method).toBe('PATCH')
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ status: true })
  })

  it('surfaces the server message when deactivating the default (422)', async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: 'Set another signatory as default first.' }, 422))
    const err = await deactivateAdmin(endpoint, 1).catch(e => e)
    expect(getErrorMessage(err)).toBe('Set another signatory as default first.')
  })

  it('surfaces field errors for a duplicate name + title (422)', async () => {
    fetchMock.mockResolvedValue(
      json({ success: false, message: 'Validation failed.', errors: { name: ['This signatory already exists.'] } }, 422)
    )
    const err = await createAdmin(endpoint, { name: 'Ana', title: 'Manager' }).catch(e => e as ApiError)
    expect((err as ApiError).errors).toEqual({ name: ['This signatory already exists.'] })
  })

  it('treats a non-Department-Head 403 as a permission error without throwing the user out', async () => {
    fetchMock.mockResolvedValue(json({ success: false, message: 'Forbidden' }, 403))
    const err = await listAdmin(endpoint, listKey, {}).catch(e => e)
    expect(err).toMatchObject({ status: 403 })
  })
})
