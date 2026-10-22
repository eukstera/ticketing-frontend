'use client'

import { useEffect, useId, useRef, useState, FormEvent } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  downloadAccomplishmentReport,
  getReportSignatories,
  SIGNATORY_MAX_LENGTH,
  type ReportSignatory,
  type SignatoryChoice,
} from '@/lib/tickets'
import { getErrorMessage, isAbortError } from '@/lib/api'
import { saveBlob } from '@/lib/download'
import { btnPrimary, btnSecondary, input } from '@/lib/styles'
import Modal from '@/components/ui/Modal'
import ErrorState from '@/components/ui/ErrorState'

interface AccomplishmentReportModalProps {
  isOpen: boolean
  onClose: () => void
}

type Status = 'idle' | 'generating' | 'error'
const CUSTOM = 'custom'
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
  const [signatories, setSignatories] = useState<ReportSignatory[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listAttempt, setListAttempt] = useState(0)
  const [selection, setSelection] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const inFlight = useRef(false)
  const downloadCtrl = useRef<AbortController | null>(null)

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

  // Untouched (null) follows the default signatory once the list has loaded.
  const defaultSignatory = signatories.find((s) => s.is_default)
  const effectiveSelection = selection ?? (defaultSignatory ? String(defaultSignatory.id) : '')
  const isCustom = effectiveSelection === CUSTOM

  // Aborts the list fetch and any in-flight download if the modal unmounts.
  useEffect(() => {
    const ctrl = new AbortController()
    getReportSignatories(ctrl.signal)
      .then((res) => {
        setSignatories(res.result.signatories)
        setListStatus('ready')
      })
      .catch((err) => {
        if (isAbortError(err)) return
        console.error(err)
        setListStatus('error')
      })
    return () => ctrl.abort()
  }, [listAttempt])

  useEffect(() => () => downloadCtrl.current?.abort(), [])

  function retryList() {
    setListStatus('loading')
    setListAttempt((n) => n + 1)
  }

  function resolveSignatory(): SignatoryChoice | undefined | null {
    if (isCustom) {
      const name = customName.trim()
      const title = customTitle.trim()
      if (!name || !title) {
        setErrorMsg('Enter both the signatory’s name and title.')
        return null
      }
      return { name, title }
    }
    // '' = the server's default (also the fallback when the list failed to load).
    return effectiveSelection ? { id: Number(effectiveSelection) } : undefined
  }

  async function handleDownload(e: FormEvent) {
    e.preventDefault()
    // A ref, not `status`: a fast double-click fires before React re-renders.
    if (inFlight.current) return
    setErrorMsg('')

    if (!dateFrom || !dateTo) {
      setErrorMsg('Select both dates.')
      return
    }
    if (dateTo < dateFrom) {
      setErrorMsg('"To" date must be on or after "From" date.')
      return
    }
    const signatory = resolveSignatory()
    if (signatory === null) return

    inFlight.current = true
    const ctrl = new AbortController()
    downloadCtrl.current = ctrl
    setStatus('generating')

    try {
      const { blob, filename } = await downloadAccomplishmentReport(
        dateFrom,
        dateTo,
        ctrl.signal,
        undefined,
        signatory
      )

      if (!saveBlob(blob, filename)) {
        setStatus('error')
        setErrorMsg('Your browser blocked the download. Allow downloads for this site and try again.')
        return
      }

      setStatus('idle')
      onClose()
    } catch (err) {
      if (isAbortError(err)) return
      console.error(err)
      setStatus('error')
      setErrorMsg(getErrorMessage(err, "Couldn't generate the report. Try again."))
    } finally {
      inFlight.current = false
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
      <p className="text-sm text-gray-500 mb-4">Choose a date range and who signs the report</p>

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

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600">
            Signatory (“Approved by”)
            <select
              value={effectiveSelection}
              onChange={(e) => {
                setSelection(e.target.value)
                setErrorMsg('')
              }}
              disabled={isGenerating || listStatus === 'loading'}
              className={`${input} mt-1 font-normal`}
            >
              {listStatus === 'loading' && <option value="">Loading signatories…</option>}
              {listStatus !== 'loading' && !defaultSignatory && (
                <option value="">Default signatory</option>
              )}
              {signatories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                  {s.is_default ? ' (default)' : ''}
                </option>
              ))}
              <option value={CUSTOM}>Someone else…</option>
            </select>
          </label>

          {listStatus === 'error' && (
            <p className="mt-1.5 text-xs text-gray-500">
              Couldn’t load saved signatories; the default will be used unless you pick “Someone
              else”.{' '}
              <button
                type="button"
                onClick={retryList}
                className="font-medium text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                Retry
              </button>
            </p>
          )}

          {isCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <label className="block text-xs font-medium text-gray-600">
                Name
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value)
                    setErrorMsg('')
                  }}
                  maxLength={SIGNATORY_MAX_LENGTH}
                  disabled={isGenerating}
                  autoComplete="off"
                  className={`${input} mt-1 font-normal`}
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Title
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => {
                    setCustomTitle(e.target.value)
                    setErrorMsg('')
                  }}
                  maxLength={SIGNATORY_MAX_LENGTH}
                  disabled={isGenerating}
                  autoComplete="off"
                  className={`${input} mt-1 font-normal`}
                />
              </label>
            </div>
          )}
        </div>

        {errorMsg && <ErrorState message={errorMsg} className="mt-3" />}
      </form>
    </Modal>
  )
}
