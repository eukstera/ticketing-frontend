import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import AdminResourcePage from '@/components/admin/AdminResourcePage'
import { ADMIN_RESOURCE_KEYS, getAdminResource } from '@/lib/adminResources'

// The /admin/<resource> pages are Server Components. Props they pass to a
// client component must be serializable; the resource config holds functions,
// so the page may only pass its string key (regression: "Functions cannot be
// passed directly to Client Components").
function findElement(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) return null
  const el = node as ReactElement<Record<string, unknown>>
  if (el.type === type) return el
  const children = el.props.children as ReactNode
  for (const child of Array.isArray(children) ? children : [children]) {
    const hit = findElement(child, type)
    if (hit) return hit
  }
  return null
}

describe('admin pages pass only serializable props', () => {
  it.each(ADMIN_RESOURCE_KEYS)('/admin/%s renders AdminResourcePage with a string key', async key => {
    const mod = await import(`../../app/admin/${key}/page.tsx`)
    const element = findElement(mod.default(), AdminResourcePage)

    expect(element).not.toBeNull()
    expect(element!.props.resource).toBe(key)
    expect(() => structuredClone(element!.props)).not.toThrow()
  })

  it('documents why: the resource config itself is not serializable', () => {
    expect(() => structuredClone({ resource: getAdminResource('users') })).toThrow()
  })

  it('every resource key resolves to a config with the same slug', () => {
    for (const key of ADMIN_RESOURCE_KEYS) expect(getAdminResource(key).slug).toBe(key)
  })
})
