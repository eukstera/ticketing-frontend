import { describe, expect, it } from 'vitest'
import { barWidth, percentOf, safeCount } from './format'

describe('percentOf', () => {
  it('returns 0 when the total is zero (no NaN/Infinity)', () => {
    expect(percentOf(0, 0)).toBe(0)
    expect(percentOf(5, 0)).toBe(0)
  })
  it('rounds and clamps', () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(7, 5)).toBe(100)
    expect(percentOf(-1, 5)).toBe(0)
  })
  it('ignores non-finite input', () => {
    expect(percentOf(NaN, 10)).toBe(0)
    expect(percentOf(1, Infinity)).toBe(0)
  })
})

describe('barWidth', () => {
  it('is 0 for an empty max', () => {
    expect(barWidth(0, 0)).toBe(0)
    expect(barWidth(3, 0)).toBe(0)
  })
  it('scales against the max', () => {
    expect(barWidth(5, 10)).toBe(50)
    expect(barWidth(10, 10)).toBe(100)
  })
})

describe('safeCount', () => {
  it('passes finite numbers through and zeroes everything else', () => {
    expect(safeCount(4)).toBe(4)
    expect(safeCount(0)).toBe(0)
    expect(safeCount(null)).toBe(0)
    expect(safeCount(undefined)).toBe(0)
    expect(safeCount(NaN)).toBe(0)
  })
})
