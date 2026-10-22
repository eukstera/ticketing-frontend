import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import ConfirmationPanel from '@/components/ConfirmationPanel'
import SurveyResults from '@/components/SurveyResults'
import type { ConfirmationInfo } from '@/types'

type Survey = ConfirmationInfo['survey']

const submitted = (over: Partial<Survey> = {}): Survey => ({
  submitted: true,
  submitted_at: '2026-10-22T12:05:00Z',
  ...over,
})

const ALL = { service: 5, assurance: 4, reliability: 3, communication: 2, access_facilities: 1, integrity: 5, outcome: 4 }
const render = (survey: Survey | null | undefined) => renderToString(<SurveyResults survey={survey} />)
const text = (html: string) =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&') // the server renderer escapes "&" in "Access & Facilities"
    .replace(/\s+/g, ' ')

describe('SurveyResults', () => {
  it('shows a labelled block for each of the seven areas, with the score and its words', () => {
    const out = text(render(submitted({ ratings: ALL })))
    for (const label of [
      'Received the appropriate service(s) needed',
      'Assurance',
      'Reliability',
      'Communication',
      'Access & Facilities',
      'Integrity',
      'Outcome',
    ]) {
      expect(out).toContain(label)
    }
    expect(out).toContain('5 of 5 · Strongly Agree')
    expect(out).toContain('4 of 5 · Agree')
    expect(out).toContain('3 of 5 · Neither Agree nor Disagree')
    expect(out).toContain('2 of 5 · Disagree')
    expect(out).toContain('1 of 5 · Strongly Disagree')
  })

  it('uses a description list so each label is tied to its answer', () => {
    const html = render(submitted({ ratings: ALL }))
    expect(html).toContain('<dl')
    expect(html.match(/<dt/g)).toHaveLength(7)
    expect(html.match(/<dd/g)).toHaveLength(7)
  })

  it('never relies on the face or colour alone: icons are hidden from assistive tech and words are always present', () => {
    const html = render(submitted({ ratings: ALL }))
    const svgs = html.match(/<svg[^>]*>/g) ?? []
    expect(svgs).toHaveLength(7)
    for (const svg of svgs) expect(svg).toContain('aria-hidden="true"')
    expect(text(html)).toContain('Strongly Disagree')
  })

  it('shows the average of the rated areas', () => {
    expect(text(render(submitted({ ratings: ALL })))).toContain('Average 3.4 out of 5')
  })

  it('shows the requester’s comments', () => {
    const out = text(render(submitted({ ratings: ALL, comments: 'Fast and polite.' })))
    expect(out).toContain('Comments')
    expect(out).toContain('Fast and polite.')
  })

  it('escapes the comments instead of treating them as HTML', () => {
    const html = render(submitted({ comments: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('says "Not rated" for skipped areas and leaves the average to the rated ones', () => {
    const out = text(render(submitted({ ratings: { service: 4, assurance: null, reliability: 2 } })))
    expect(out).toContain('4 of 5 · Agree')
    expect(out).toContain('Not rated')
    expect(out).toContain('Average 3 out of 5')
  })

  it('shows comments alone when there are no ratings', () => {
    const out = text(render(submitted({ ratings: null, comments: 'No complaints.' })))
    expect(out).toContain('No complaints.')
    expect(out).not.toContain('Average')
    expect(out).not.toContain('Not rated')
  })

  it('renders nothing for a survey that was not submitted', () => {
    expect(render(submitted({ submitted: false, submitted_at: null, ratings: ALL, comments: 'x' }))).toBe('')
  })

  it('renders nothing when an older response has neither ratings nor comments', () => {
    expect(render(submitted())).toBe('')
    expect(render(submitted({ ratings: {}, comments: '   ' }))).toBe('')
    expect(render(null)).toBe('')
    expect(render(undefined)).toBe('')
  })

  it('ignores scores outside 1-5 instead of showing nonsense', () => {
    const out = text(render(submitted({ ratings: { service: 9, assurance: 0, reliability: 4 } })))
    expect(out).not.toContain('9 of 5')
    expect(out).not.toContain('0 of 5')
    expect(out).toContain('4 of 5 · Agree')
  })

  it('lays out one column on phones and two from small screens up', () => {
    const html = render(submitted({ ratings: ALL, comments: 'A very long unbroken comment '.repeat(5) }))
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('sm:grid-cols-2')
    // long comments wrap instead of pushing the page sideways
    expect(html).toContain('break-words')
  })
})

describe('survey inside the confirmation panel', () => {
  const base: ConfirmationInfo = {
    state: 'confirmed',
    completion_notes: 'Replaced the faulty switch.',
    completed_by: { id: 7, first_name: 'Ana', last_name: 'Tech' },
    completed_at: '2026-10-22T09:00:00Z',
    auto_close_at: null,
    channel: 'email',
    responded_at: '2026-10-22T12:00:00Z',
    dispute_reason: null,
    requester_email: 'req@example.com',
    mail: { status: 'sent', attempts: 1 },
    survey: { submitted: false, submitted_at: null },
  }
  const panel = (survey: Survey) =>
    renderToString(<ConfirmationPanel confirmation={{ ...base, survey }} canResend={false} canClose={false} />)

  it('shows the ratings and comments once the survey is in', () => {
    const out = text(panel(submitted({ ratings: ALL, comments: 'Fast and polite.' })))
    expect(out).toContain('Customer satisfaction survey')
    expect(out).toContain('5 of 5 · Strongly Agree')
    expect(out).toContain('Fast and polite.')
  })

  it('keeps the plain "Submitted" line for an older response without the details', () => {
    const out = text(panel(submitted()))
    expect(out).toContain('Submitted')
    expect(out).not.toContain('Customer satisfaction survey')
  })

  it('shows no survey block when it has not been submitted', () => {
    const out = text(panel({ submitted: false, submitted_at: null }))
    expect(out).toContain('Not submitted')
    expect(out).not.toContain('Customer satisfaction survey')
  })
})
