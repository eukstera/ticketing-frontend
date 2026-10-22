// components/SurveyResults.tsx
import { Angry, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react'
import { RATING_MAX, averageRating, ratingRows, surveyComments } from '@/lib/survey'
import type { ConfirmationInfo } from '@/types'

// Icon and colour per score. The words and the number are always shown too, so
// the rating never depends on colour or on recognising a face.
const SCORE_STYLE: Record<number, { Icon: LucideIcon; color: string }> = {
  1: { Icon: Angry, color: 'text-red-600' },
  2: { Icon: Frown, color: 'text-orange-600' },
  3: { Icon: Meh, color: 'text-amber-600' },
  4: { Icon: Smile, color: 'text-lime-700' },
  5: { Icon: Laugh, color: 'text-green-700' },
}

/**
 * What the requester answered in the Customer Satisfaction Survey: a labelled
 * block per area (face, score and words) and their comments. Renders nothing
 * until a survey is submitted, and copes with ratings or comments being absent
 * (older responses, or a survey with only comments).
 */
export default function SurveyResults({ survey }: { survey: ConfirmationInfo['survey'] | null | undefined }) {
  if (!survey?.submitted) return null
  const rows = ratingRows(survey.ratings)
  const rated = rows.some(r => r.score !== null)
  const average = averageRating(survey.ratings)
  const comments = surveyComments(survey.comments)
  if (!rated && !comments) return null

  return (
    <section aria-labelledby="survey-heading" className="mt-4 border-t border-gray-100 pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="survey-heading" className="text-sm font-semibold text-gray-800">
          Customer satisfaction survey
        </h3>
        {average !== null && (
          <p className="text-xs text-gray-600">
            {`Average ${average} out of ${RATING_MAX}`}
          </p>
        )}
      </div>

      {rated && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(row => {
            const style = row.score === null ? null : SCORE_STYLE[row.score]
            return (
              <div key={row.key} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <dt className="text-xs text-gray-500">{row.label}</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm">
                  {style && <style.Icon size={18} className={`shrink-0 ${style.color}`} aria-hidden="true" />}
                  {row.score === null ? (
                    <span className="text-gray-500">{row.text}</span>
                  ) : (
                    <span className="font-medium text-gray-800">
                      {`${row.score} of ${RATING_MAX}`}
                      <span className="font-normal text-gray-600">{` · ${row.text}`}</span>
                    </span>
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      )}

      {comments && (
        <div className={rated ? 'mt-3' : ''}>
          <p className="text-xs text-gray-500">Comments</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {comments}
          </p>
        </div>
      )}
    </section>
  )
}
