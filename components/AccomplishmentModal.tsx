'use client'

import { useId, useState, FormEvent } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadAccomplishmentReport } from '@/lib/tickets'
import { btnPrimary, btnSecondary, input } from '@/lib/styles'
import Modal from '@/components/ui/Modal'
import ErrorState from '@/components/ui/ErrorState'

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
            className={`${btnSecondary} flex-1`}
          >
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isGenerating} className={`${btnPrimary} flex-1`}>
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Generating…
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                Download
              </>
            )}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">Choose a date range</p>

      <form id={formId} onSubmit={handleDownload}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              aria-pressed={activePreset === p.key}
              className={`text-xs font-medium px-2 py-1.5 rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
                className={`${input} mt-1 font-normal`}
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
                className={`${input} mt-1 font-normal`}
              />
            </label>
          </div>
        </div>

        {errorMsg && <ErrorState message={errorMsg} className="mt-3" />}
      </form>
    </Modal>
  )
}
