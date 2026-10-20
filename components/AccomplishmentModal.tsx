'use client'

import { useId, useState, FormEvent } from 'react'
import { downloadAccomplishmentReport } from '@/lib/tickets'
import Modal from '@/components/ui/Modal'

interface AccomplishmentReportModalProps {
  isOpen: boolean
  onClose: () => void
}

type Status = 'idle' | 'generating' | 'error'
type Preset = 'today' | 'week' | 'month' | 'last30' | 'cutoff1' | 'cutoff2' | null

// Local calendar date (toISOString would shift to UTC and, e.g. in UTC+8,
// report yesterday's date before 08:00).
function toISODate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function presetRange(preset: Exclude<Preset, null>): { from: string; to: string } {
  const now = new Date()
  const to = new Date(now)
  const from = new Date(now)

  if (preset === 'week') {
    const day = now.getDay() || 7 // Monday-start week
    from.setDate(now.getDate() - day + 1)
  } else if (preset === 'month') {
    from.setDate(1)
  } else if (preset === 'last30') {
    from.setDate(now.getDate() - 29)
  } else if (preset === 'cutoff1') {
    // 1st cut-off: the 1st to the 15th of the current month
    from.setDate(1)
    to.setDate(15)
  } else if (preset === 'cutoff2') {
    // 2nd cut-off: the 16th to the last day of the current month
    from.setDate(16)
    to.setMonth(to.getMonth() + 1, 0) // day 0 of next month = last day of this month
  }
  // 'today' leaves from === to === now

  return { from: toISODate(from), to: toISODate(to) }
}

const PRESETS: { key: Exclude<Preset, null>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'cutoff1', label: '1st cut-off (1–15)' },
  { key: 'cutoff2', label: '2nd cut-off (16–end)' },
]

// Mounted only while open, so the form starts fresh every time without a
// reset effect. Escape/backdrop/focus handling comes from <Modal>.
export default function AccomplishmentReportModal({
  isOpen,
  onClose,
}: AccomplishmentReportModalProps) {
  if (!isOpen) return null
  return <AccomplishmentReportContent onClose={onClose} />
}

function AccomplishmentReportContent({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState<Preset>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isGenerating = status === 'generating'

  function applyPreset(preset: Exclude<Preset, null>) {
    const { from, to } = presetRange(preset)
    setDateFrom(from)
    setDateTo(to)
    setActivePreset(preset)
    setErrorMsg('')
  }

  function handleManualDateChange(which: 'from' | 'to', value: string) {
    if (which === 'from') setDateFrom(value)
    else setDateTo(value)
    setActivePreset(null)
    setErrorMsg('')
  }

  async function handleDownload(e: FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!dateFrom || !dateTo) {
      setErrorMsg('Select both dates.')
      return
    }
    if (dateTo < dateFrom) {
      setErrorMsg('"To" date must be on or after "From" date.')
      return
    }

    setStatus('generating')

    try {
      const { blob, filename } = await downloadAccomplishmentReport(dateFrom, dateTo)

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      setStatus('idle')
      onClose()
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErrorMsg("Couldn't generate the report. Try again.")
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Download report"
      closeOnBackdrop={!isGenerating}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 px-5 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 px-5 py-1.5 text-white rounded text-sm font-medium transition disabled:opacity-60 bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M4 19h16" />
                </svg>
                Download
              </>
            )}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-gray-500 mb-4">Choose a date range</p>

      <form id={formId} onSubmit={handleDownload}>
        <div className="grid grid-cols-3 gap-1.5 mb-3.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`text-xs font-medium px-2 py-1.5 rounded-md border transition whitespace-nowrap ${
                activePreset === p.key
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleManualDateChange('from', e.target.value)}
                required
                className="mt-1 w-full text-sm font-normal border border-gray-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleManualDateChange('to', e.target.value)}
                required
                className="mt-1 w-full text-sm font-normal border border-gray-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mt-3 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  )
}
