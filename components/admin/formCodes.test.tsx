// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/form-codes',
  useSearchParams: () => new URLSearchParams(),
}))
// The shell's job (403 gate, nav) is tested elsewhere; here it just renders the page for a Section Head.
vi.mock('@/components/admin/AdminShell', () => ({
  default: ({ actions, children }: { actions?: ReactNode; children: (me: unknown) => ReactNode }) => (
    <div>
      <div data-testid="actions">{actions}</div>
      {children({ id: 1, role: { id: 2, name: 'Section Head', key: 'department-head' } })}
    </div>
  ),
}))
const listAdmin = vi.fn()
vi.mock('@/lib/admin', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/admin')>()
  return { ...actual, listAdmin: (...args: unknown[]) => listAdmin(...args) }
})

import AdminResourcePage from '@/components/admin/AdminResourcePage'
import { getAdminResource } from '@/lib/adminResources'

const ROWS = [
  { id: 1, key: 'job_order', name: 'ICTS Job Order Form', document_code: 'GBTRGHSC-ICTS-04-0003-0000', effectivity_date: '(TBA)', status: true },
  { id: 2, key: 'job_order_blank', name: 'ICTS Job Order Form (Blank)', document_code: 'GBTRGHSC-ICTS-04-0004-0000', effectivity_date: '(TBA)', status: true },
]

let container: HTMLDivElement
let root: Root | null = null

beforeEach(() => {
  listAdmin.mockReset()
  listAdmin.mockResolvedValue({ data: ROWS, current_page: 1, last_page: 1, per_page: 15, total: 2 })
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
})

async function render() {
  await act(async () => {
    root = createRoot(container)
    root.render(<AdminResourcePage resource="form-codes" />)
  })
}

describe('form codes config', () => {
  it('lists /admin/form-codes under result.form_codes and edits only the code and effectivity date', () => {
    const r = getAdminResource('form-codes')
    expect(r.endpoint).toBe('/admin/form-codes')
    expect(r.listKey).toBe('form_codes')
    expect(r.editOnly).toBe(true)
    expect(r.fields.map(f => f.name)).toEqual(['document_code', 'effectivity_date'])
    expect(r.fields.every(f => f.required)).toBe(true)
  })
})

describe('an edit-only admin page (form codes)', () => {
  it('shows the seeded rows with an Edit button each', async () => {
    await render()
    expect(container.textContent).toContain('GBTRGHSC-ICTS-04-0003-0000')
    expect(container.textContent).toContain('ICTS Job Order Form (Blank)')
    const edits = [...container.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Edit')
    expect(edits).toHaveLength(2)
  })

  it('offers no Add, Deactivate, Reactivate or status filter, and no Status column', async () => {
    await render()
    const text = container.textContent ?? ''
    expect(container.querySelector('[data-testid="actions"]')!.textContent).toBe('')
    expect(text).not.toContain('Add form code')
    expect(text).not.toContain('Deactivate')
    expect(text).not.toContain('Reactivate')
    expect(container.querySelector('[aria-label="Filter by status"]')).toBeNull()
    const headers = [...container.querySelectorAll('th')].map(th => th.textContent?.trim())
    expect(headers).toEqual(['Form', 'Document code', 'Effectivity date', 'Actions'])
  })

  it('other resources still offer Add and Deactivate', async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(<AdminResourcePage resource="report-signatories" />)
    })
    expect(container.querySelector('[data-testid="actions"]')!.textContent).toContain('Add signatory')
    expect(container.textContent).toContain('Deactivate')
  })
})
