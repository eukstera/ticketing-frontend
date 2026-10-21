import { describe, expect, it } from 'vitest'
import {
  PRIORITY_FALLBACK,
  PRIORITY_STYLES,
  PRIORITY_SOLID_FALLBACKS,
  STATUS_ALL,
  STATUS_FALLBACK,
  STATUS_STYLES,
} from '@/lib/styles'

describe('STATUS_STYLES', () => {
  it.each(Object.entries(STATUS_STYLES))('%s defines every variant', (_label, s) => {
    for (const key of ['badge', 'pill', 'ring', 'card'] as const) expect(s[key]).not.toBe('')
  })

  it('stat cards keep their tinted look with a hover shade', () => {
    expect(STATUS_STYLES.Open.card).toBe('bg-blue-100 border-blue-200 text-blue-700 hover:bg-blue-200')
    expect(STATUS_STYLES.Overdue.card).toBe('bg-red-100 border-red-200 text-red-700 hover:bg-red-200')
  })

  it('the "All" pill and the fallback are neutral gray', () => {
    expect(STATUS_ALL.pill).toBe('bg-gray-100 text-gray-700 border-gray-300')
    expect(STATUS_ALL.ring).toBe('ring-gray-400')
    expect(STATUS_FALLBACK.badge).toBe('bg-gray-100 text-gray-700')
  })
})

describe('PRIORITY_STYLES', () => {
  it.each(Object.entries(PRIORITY_STYLES))('%s defines every variant', (_label, s) => {
    for (const key of ['text', 'pill', 'badge', 'solid', 'dot', 'ring', 'highlight'] as const) {
      expect(s[key]).not.toBe('')
    }
  })

  it('Complex is fuchsia everywhere, including the chart bar', () => {
    const c = PRIORITY_STYLES.Complex
    expect(c.solid).toBe('bg-fuchsia-500')
    for (const v of [c.text, c.pill, c.badge, c.dot, c.ring]) expect(v).toContain('fuchsia')
  })

  it('the fallback is neutral and the chart fallbacks are distinct colours', () => {
    expect(PRIORITY_FALLBACK.text).toBe('text-gray-600')
    expect(PRIORITY_FALLBACK.pill).toBe('bg-white text-gray-700 border-gray-300')
    expect(PRIORITY_FALLBACK.ring).toBe('ring-gray-400')
    expect(new Set(PRIORITY_SOLID_FALLBACKS).size).toBe(PRIORITY_SOLID_FALLBACKS.length)
  })
})
