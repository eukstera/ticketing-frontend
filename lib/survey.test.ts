import { describe, expect, it } from 'vitest'
import { RATING_LABELS, SURVEY_CATEGORIES, averageRating, ratingRows, surveyComments, validScore } from '@/lib/survey'

describe('survey areas', () => {
  it('lists the seven areas in form order', () => {
    expect(SURVEY_CATEGORIES.map(c => c.key)).toEqual([
      'service',
      'assurance',
      'reliability',
      'communication',
      'access_facilities',
      'integrity',
      'outcome',
    ])
    expect(SURVEY_CATEGORIES.map(c => c.label)).toEqual([
      'Received the appropriate service(s) needed',
      'Assurance',
      'Reliability',
      'Communication',
      'Access & Facilities',
      'Integrity',
      'Outcome',
    ])
  })

  it('uses the paper form’s agreement scale, with 5 the best', () => {
    expect([1, 2, 3, 4, 5].map(n => RATING_LABELS[n])).toEqual([
      'Strongly Disagree',
      'Disagree',
      'Neither Agree nor Disagree',
      'Agree',
      'Strongly Agree',
    ])
  })
})

describe('validScore', () => {
  it('accepts whole numbers 1 to 5 only', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(validScore(n)).toBe(n)
    for (const bad of [0, 6, -1, 3.5, NaN, Infinity, '4', null, undefined, {}, true]) expect(validScore(bad)).toBeNull()
  })
})

describe('ratingRows', () => {
  it('gives one row per area in order, with the score and its words', () => {
    const rows = ratingRows({ service: 5, assurance: 4, reliability: 3, communication: 2, access_facilities: 1, integrity: 5, outcome: 4 })
    expect(rows).toHaveLength(7)
    expect(rows.map(r => r.score)).toEqual([5, 4, 3, 2, 1, 5, 4])
    expect(rows[0]).toMatchObject({
      key: 'service',
      label: 'Received the appropriate service(s) needed',
      text: 'Strongly Agree',
    })
    expect(rows[4]).toMatchObject({ key: 'access_facilities', label: 'Access & Facilities', text: 'Strongly Disagree' })
  })

  it('marks skipped, null or invalid areas as not rated', () => {
    const rows = ratingRows({ service: 5, assurance: null, reliability: 9, communication: 0 })
    expect(rows[0].score).toBe(5)
    for (const row of rows.slice(1)) expect(row).toMatchObject({ score: null, text: 'Not rated' })
  })

  it('copes with ratings being absent (older responses)', () => {
    for (const none of [undefined, null, {}]) {
      const rows = ratingRows(none)
      expect(rows).toHaveLength(7)
      expect(rows.every(r => r.score === null)).toBe(true)
    }
  })

  it('ignores areas it does not know', () => {
    const rows = ratingRows({ service: 4, parking: 5 } as never)
    expect(rows.map(r => r.key)).not.toContain('parking')
    expect(rows).toHaveLength(7)
  })
})

describe('averageRating', () => {
  it('is the mean of the rated areas to one decimal', () => {
    expect(averageRating({ service: 5, assurance: 4, reliability: 4 })).toBe(4.3)
    expect(averageRating({ service: 5, assurance: 5 })).toBe(5)
    expect(averageRating({ service: 1, assurance: 2 })).toBe(1.5)
  })

  it('skips unrated and invalid areas rather than counting them as zero', () => {
    expect(averageRating({ service: 4, assurance: null, reliability: 99 })).toBe(4)
  })

  it('is null when nothing was rated', () => {
    expect(averageRating({})).toBeNull()
    expect(averageRating(null)).toBeNull()
    expect(averageRating(undefined)).toBeNull()
  })
})

describe('surveyComments', () => {
  it('keeps the requester’s words, trimmed', () => {
    expect(surveyComments('  Fast and polite.  ')).toBe('Fast and polite.')
  })

  it('treats blank or non-text as no comments', () => {
    for (const none of ['', '   ', null, undefined, 42, {}]) expect(surveyComments(none)).toBeNull()
  })
})
