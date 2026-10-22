import type { SurveyCategory, SurveyRatings } from '@/types'

// The Customer Satisfaction Survey a requester fills in after a ticket is
// completed (the paper form and the public survey page use the same scale):
// seven statements answered on an agreement scale from 1 (Strongly Disagree)
// to 5 (Strongly Agree, the best), plus free-text comments.

export const SURVEY_CATEGORIES: { key: SurveyCategory; label: string }[] = [
  { key: 'service', label: 'Received the appropriate service(s) needed' },
  { key: 'assurance', label: 'Assurance' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'communication', label: 'Communication' },
  { key: 'access_facilities', label: 'Access & Facilities' },
  { key: 'integrity', label: 'Integrity' },
  { key: 'outcome', label: 'Outcome' },
]

export const RATING_MIN = 1
export const RATING_MAX = 5

export const RATING_LABELS: Record<number, string> = {
  1: 'Strongly Disagree',
  2: 'Disagree',
  3: 'Neither Agree nor Disagree',
  4: 'Agree',
  5: 'Strongly Agree',
}

/** A usable score is a whole number from 1 to 5; anything else (null, 0, 7, "4") is "not rated". */
export function validScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX
    ? value
    : null
}

export interface RatingRow {
  key: SurveyCategory
  label: string
  /** null = the requester didn't rate this area (or an older server sent nothing). */
  score: number | null
  /** "Agree", or "Not rated". */
  text: string
}

/** One row per survey area, in form order, whatever the API sent. Unknown keys are ignored. */
export function ratingRows(ratings: SurveyRatings | null | undefined): RatingRow[] {
  return SURVEY_CATEGORIES.map(({ key, label }) => {
    const score = validScore(ratings?.[key])
    return { key, label, score, text: score === null ? 'Not rated' : RATING_LABELS[score] }
  })
}

/** The mean of the rated areas to one decimal (4.3), or null when nothing was rated. */
export function averageRating(ratings: SurveyRatings | null | undefined): number | null {
  const scores = ratingRows(ratings).flatMap(r => (r.score === null ? [] : [r.score]))
  if (scores.length === 0) return null
  return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
}

/** The requester's own words; blank or non-text counts as none. */
export function surveyComments(comments: unknown): string | null {
  return typeof comments === 'string' && comments.trim() ? comments.trim() : null
}
