import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import Field, { fieldClass } from '@/components/ui/Field'
import { input, inputError } from '@/lib/styles'

function attr(html: string, tag: string, name: string) {
  const el = html.match(new RegExp(`<${tag}[^>]*>`))?.[0] ?? ''
  return el.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
}

describe('Field', () => {
  it('ties the label to the control through the same id', () => {
    const html = renderToString(
      <Field label="Email">{p => <input {...p} type="email" />}</Field>
    )
    const labelFor = attr(html, 'label', 'for')
    expect(labelFor).toBeTruthy()
    expect(attr(html, 'input', 'id')).toBe(labelFor)
  })

  it('marks required fields (decorative asterisk, required attribute on the control)', () => {
    const html = renderToString(
      <Field label="Name" required>{p => <input {...p} />}</Field>
    )
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*> \*<\/span>/)
    expect(html).toMatch(/<input[^>]*\srequired=""/)
  })

  it('has no aria-describedby and aria-invalid=false when valid and hintless', () => {
    const html = renderToString(<Field label="Name">{p => <input {...p} />}</Field>)
    expect(attr(html, 'input', 'aria-describedby')).toBeUndefined()
    expect(attr(html, 'input', 'aria-invalid')).toBe('false')
    expect(html).not.toContain('role="alert"')
  })

  it('announces the error and links it (and the hint) to the control', () => {
    const html = renderToString(
      <Field label="Password" hint="At least 8 characters" error="Too short">
        {p => <input {...p} type="password" />}
      </Field>
    )
    expect(attr(html, 'input', 'aria-invalid')).toBe('true')
    const describedBy = attr(html, 'input', 'aria-describedby') ?? ''
    const ids = describedBy.split(' ')
    expect(ids).toHaveLength(2)
    const errorId = attr(html, 'p', 'id')
    expect(errorId).toBeTruthy()
    expect(ids).toContain(errorId)
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>Too short<\/p>/)
    expect(html).toContain('At least 8 characters')
  })

  it('lets callers override the label/error classes', () => {
    const html = renderToString(
      <Field label="Email" error="Bad" labelClassName="lbl-x" errorClassName="err-x">
        {p => <input {...p} />}
      </Field>
    )
    expect(attr(html, 'label', 'class')).toBe('lbl-x')
    expect(attr(html, 'p', 'class')).toBe('err-x')
  })
})

describe('fieldClass', () => {
  it('adds the error styling only when invalid', () => {
    expect(fieldClass(false)).toBe(input)
    expect(fieldClass(true)).toBe(`${input} ${inputError}`)
    expect(fieldClass(true, 'base')).toBe(`base ${inputError}`)
  })
})
