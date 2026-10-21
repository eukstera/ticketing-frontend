import { describe, expect, it } from 'vitest'
import type { AdminRow } from '@/lib/admin'
import type { AuthUser } from '@/lib/auth'
import {
  ADMIN_RESOURCES,
  ADMIN_RESOURCE_KEYS,
  DEPARTMENT_HEAD_ROLE,
  OTHERS_NATURE_OF_WORK,
  getAdminResource,
} from '@/lib/adminResources'

const byKey = (key: (typeof ADMIN_RESOURCE_KEYS)[number]) => getAdminResource(key)

describe('config invariants', () => {
  it('has exactly one config per declared key, in the same order', () => {
    expect(ADMIN_RESOURCES.map(r => r.slug)).toEqual([...ADMIN_RESOURCE_KEYS])
  })

  it.each(ADMIN_RESOURCES.map(r => [r.slug, r] as const))('%s is well-formed', (_slug, r) => {
    expect(r.endpoint).toMatch(/^\/admin\//)
    expect(r.listKey).not.toBe('')
    expect(r.columns.length).toBeGreaterThan(0)
    expect(r.fields.length).toBeGreaterThan(0)

    const names = r.fields.map(f => f.name)
    expect(new Set(names).size).toBe(names.length)
    for (const f of r.fields) {
      if (f.dependsOn) expect(names).toContain(f.dependsOn)
      if (f.type === 'select') expect(f.options).toBeDefined()
      else expect(f.options).toBeUndefined()
    }
  })

  it('only the password field is create-only-required, and it is a password input', () => {
    for (const r of ADMIN_RESOURCES) {
      for (const f of r.fields) {
        if (f.requiredOnCreateOnly) {
          expect(f.type).toBe('password')
          expect(f.required).toBeFalsy()
        }
      }
    }
    expect(byKey('users').fields.find(f => f.name === 'password')?.min).toBe(8)
  })

  it('designations are created through the public route but edited under /admin', () => {
    const d = byKey('designations')
    expect(d.createEndpoint).toBe('/designations')
    expect(d.endpoint).toBe('/admin/designations')
  })

  it('every department dropdown (fields and filters) uses the lookup endpoint', () => {
    for (const r of ADMIN_RESOURCES) {
      const sources = [
        ...r.fields.filter(f => f.name === 'department_id').map(f => f.options!),
        ...(r.filters ?? []).map(f => f.options),
      ]
      for (const s of sources) expect(s.endpoint({})).toBe('/lookups/departments')
    }
  })

  it('the designation select waits for a department and scopes to it', () => {
    const field = byKey('users').fields.find(f => f.name === 'designation_id')!
    expect(field.dependsOn).toBe('department_id')
    expect(field.options!.endpoint({})).toBeNull()
    const url = field.options!.endpoint({ department_id: '2' })!
    expect(url).toContain('/admin/designations')
    expect(new URLSearchParams(url.split('?')[1]).get('department_id')).toBe('2')
  })

  it('the role select reads active roles from GET /roles', () => {
    expect(byKey('users').fields.find(f => f.name === 'role_id')!.options!.endpoint({})).toBe('/roles')
  })
})

describe('row locks', () => {
  const me = { id: 7 } as AuthUser

  it('locks edit and deactivate for the Department Head role only', () => {
    const lock = byKey('roles').lock!
    expect(lock({ id: 2, name: DEPARTMENT_HEAD_ROLE }, me)).toMatchObject({
      edit: expect.any(String),
      deactivate: expect.any(String),
    })
    expect(lock({ id: 1, name: 'Normal User' }, me)).toBeNull()
  })

  it('locks edit and deactivate for the "Others" nature of work only', () => {
    const lock = byKey('nature-of-work').lock!
    expect(lock({ id: 9, label: OTHERS_NATURE_OF_WORK }, me)).toMatchObject({
      edit: expect.any(String),
      deactivate: expect.any(String),
    })
    expect(lock({ id: 1, label: 'Repair' }, me)).toBeNull()
  })

  it('leaves concern types and departments unlocked', () => {
    expect(byKey('concern-types').lock).toBeUndefined()
    expect(byKey('departments').lock).toBeUndefined()
  })

  it('blocks only self-deactivation for users', () => {
    const lock = byKey('users').lock!
    expect(lock({ id: 7 }, me)).toEqual({ deactivate: expect.any(String) })
    expect(lock({ id: 8 }, me)).toBeNull()
    expect(lock({ id: 7 }, null)).toBeNull()
  })
})

describe('column values', () => {
  const ctx = { departments: { 2: 'Engineering' } }

  it('renders the user row from nested role/department/designation names', () => {
    const row: AdminRow = {
      id: 1,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      department: { id: 1, name: 'IT' },
      designation: { id: 3, name: 'Technician' },
      role: { id: 1, name: 'Normal User' },
    }
    expect(byKey('users').columns.map(c => c.value(row, ctx))).toEqual([
      'Jane Doe',
      'jane@example.com',
      'IT',
      'Technician',
      'Normal User',
    ])
  })

  it('tolerates missing nested objects', () => {
    const values = byKey('users').columns.map(c => c.value({ id: 1 }, ctx))
    expect(values).toEqual(['', '', '', '', ''])
  })

  it('looks up the department name for designations and priorities', () => {
    const row: AdminRow = { id: 1, department_id: 2, designation: 'Foreman', level: 'High', sla_days: 3 }
    expect(byKey('designations').columns.map(c => c.value(row, ctx))).toEqual(['Foreman', 'Engineering'])
    expect(byKey('priorities').columns.map(c => c.value(row, ctx))).toEqual(['High', '3', 'Engineering'])
  })

  it('shows label/name columns for the simple resources', () => {
    expect(byKey('concern-types').columns[0].value({ id: 1, label: 'Network' }, ctx)).toBe('Network')
    expect(byKey('nature-of-work').columns[0].value({ id: 1, label: 'Repair' }, ctx)).toBe('Repair')
    expect(byKey('departments').columns[0].value({ id: 1, name: 'IT' }, ctx)).toBe('IT')
  })

  it('rowTitle names the row for aria-labels and confirm text', () => {
    expect(byKey('users').rowTitle({ id: 1, first_name: 'Jane', last_name: 'Doe' })).toBe('Jane Doe')
    expect(byKey('priorities').rowTitle({ id: 1, level: 'High' })).toBe('High')
  })
})
