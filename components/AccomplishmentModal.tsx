'use client'

import { useEffect, useState, FormEvent } from 'react'
import { downloadAccomplishmentReport } from '@/lib/tickets'

interface AccomplishmentReportModalProps {
  isOpen: boolean
  onClose: () => void
}

type Status = 'idle' | 'generating' | 'error'
type Preset = 'today' | 'week' | 'month' | 'last30' | 'cutoff1' | 'cutoff2' | null

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
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

export default function AccomplishmentReportModal({
  isOpen,
  onClose,
}: AccomplishmentReportModalProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activePreset, setActivePreset] = useState<Preset>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Reset form state each time the modal is (re)opened
  useEffect(() => {
    if (isOpen) {
      setDateFrom('')
      setDateTo('')
      setActivePreset(null)
      setStatus('idle')
      setErrorMsg('')
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

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
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-blue-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M4 19h16" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-800 leading-tight">
                Download report
              </h2>
              <p className="text-[13px] text-gray-500 mt-0.5">
                Choose a date range
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition -mt-1 -mr-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleDownload}>
          <div className="grid grid-cols-3 gap-1.5 mt-4 mb-3.5">
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
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleManualDateChange('from', e.target.value)}
                required
                className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleManualDateChange('to', e.target.value)}
                required
                className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mt-3 text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              {errorMsg}
            </div>
          )}

          <div className="flex justify-between gap-3 mt-5">
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
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center gap-1.5 px-5 py-1.5 text-white rounded text-sm font-medium transition disabled:opacity-60 bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M4 19h16" />
                  </svg>
                  Download
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}