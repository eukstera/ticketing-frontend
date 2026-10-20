import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import LoginForm from '@/components/auth/LoginForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

// renderToString is the pre-hydration HTML: exactly what the browser has if the
// JS never attaches (e.g. a blocked dev origin) and the form submits natively.
describe('LoginForm before hydration', () => {
  const html = renderToString(<LoginForm />)

  it('posts instead of putting credentials in the URL', () => {
    expect(html).toMatch(/<form[^>]*method="post"/)
    expect(html).not.toMatch(/<form[^>]*method="get"/i)
  })

  it('keeps the submit button disabled until hydrated', () => {
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
  })

  it('has no credential-bearing name attributes but keeps autocomplete', () => {
    const inputs = html.match(/<input[^>]*>/g) ?? []
    expect(inputs).toHaveLength(2)
    for (const input of inputs) expect(input).not.toMatch(/\sname="/)
    // React's server output spells the attribute autoComplete
    expect(html).toMatch(/autocomplete="email"/i)
    expect(html).toMatch(/autocomplete="current-password"/i)
  })
})
