'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Construction, Inbox, Lock, Plus, Search, SearchX } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import AdminFormModal from '@/components/admin/AdminFormModal'
import ConfirmModal from '@/components/ConfirmModal'
import Pagination from '@/components/department-tickets/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/Toast'
import { AdminStatus, useAdminListParams } from '@/hooks/useAdminListParams'
import { useOptions } from '@/hooks/useOptions'
import { isAbortError, isApiError } from '@/lib/api'
import { isUnavailable, safeErrorMessage } from '@/lib/adminErrors'
import {
  ADMIN_PER_PAGE,
  AdminRow,
  Paginator,
  deactivateAdmin,
  listAdmin,
  reactivateAdmin,
} from '@/lib/admin'
import { AdminResource, AdminResourceKey, RowContext, getAdminResource } from '@/lib/adminResources'
import {
  STATUS_FALLBACK,
  STATUS_STYLES,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSm,
  btnSuccess,
  input,
  inputAuto,
} from '@/lib/styles'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_PILLS: { value: AdminStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

interface ListResult {
  key: string
  data?: Paginator<AdminRow>
  error?: string
  /** 404 (route not on the server yet) or 403 (no permission): not retryable. */
  blocked?: 'unavailable' | 'forbidden'
}

const ACTIVE_BADGE = STATUS_STYLES.Completed.badge
const INACTIVE_BADGE = STATUS_FALLBACK.badge

// What the list's ErrorState says: always names the resource, then a safe reason
// (never raw server text). 404/405 and 403 are handled as blocked states instead.
function listErrorMessage(title: string, err: unknown): string {
  return `Couldn't load ${title.toLowerCase()}. ${safeErrorMessage(err, 'Try again.')}`
}

// Generic admin list + create/edit/deactivate screen driven by an
// AdminResource config. Must render inside a <Suspense> boundary
// (useSearchParams for the URL-backed list state).
export default function AdminResourcePage({ resource: resourceKey }: { resource: AdminResourceKey }) {
  const resource = getAdminResource(resourceKey)
  const uid = useId()
  const filters = resource.filters ?? []
  const { params, update } = useAdminListParams(filters.map(f => f.param))

  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState<ListResult | null>(null)
  const [departments, setDepartments] = useState<Record<number, string>>({})
  const [form, setForm] = useState<{ row: AdminRow | null } | null>(null)
  const [toDeactivate, setToDeactivate] = useState<AdminRow | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  // The draft only wins while the URL still holds the value it was typed over;
  // once the URL moves (debounce landed, or back/forward) the URL takes over.
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchValue = draft && draft.base === params.search ? draft.value : params.search

  // Do not fire a navigation after the page is gone.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  function handleSearch(value: string) {
    setDraft({ base: params.search, value })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => update({ search: value.trim() }, 'replace'), SEARCH_DEBOUNCE_MS)
  }

  const key = JSON.stringify([resource.endpoint, params, refresh])

  useEffect(() => {
    const controller = new AbortController()
    listAdmin(
      resource.endpoint,
      resource.listKey,
      {
        page: params.page,
        per_page: ADMIN_PER_PAGE,
        search: params.search,
        status: params.status === 'all' ? undefined : params.status,
        ...params.filters,
      },
      controller.signal
    )
      .then(data => setResult({ key, data }))
      .catch(err => {
        if (isAbortError(err)) return
        // 403 must not log the user out and must not refetch: only a 401 ends the
        // session (api.ts), and a blocked list has no controls left to re-trigger it.
        if (isUnavailable(err)) return setResult({ key, blocked: 'unavailable' })
        if (isApiError(err) && err.status === 403) return setResult({ key, blocked: 'forbidden' })
        console.error(err)
        setResult({ key, error: listErrorMessage(resource.title, err) })
      })
    return () => controller.abort()
  }, [key, resource, params])

  // Department names for resources that show a department column.
  useEffect(() => {
    if (!resource.needsDepartments) return
    const controller = new AbortController()
    listAdmin('/admin/departments', 'departments', { per_page: 100 }, controller.signal)
      .then(res => {
        const map: Record<number, string> = {}
        for (const d of res.data) map[d.id] = String(d.name ?? '')
        setDepartments(map)
      })
      .catch(err => {
        if (isAbortError(err)) return
        console.error(err)
        toast("Couldn't load department names.", 'error')
      })
    return () => controller.abort()
  }, [resource])

  const data = result?.data
  const stale = !!result && result.key !== key
  const loadingFirst = !result || (!data && !result.error && !result.blocked && stale)
  const error = result && !stale ? result.error : undefined
  const blocked = result && !stale ? result.blocked : undefined

  // Deactivating the last row on the last page leaves an empty page behind.
  useEffect(() => {
    if (data && !stale && data.data.length === 0 && params.page > 1 && data.last_page < params.page) {
      update({ page: Math.max(1, data.last_page) }, 'replace')
    }
  }, [data, stale, params.page, update])

  const ctx: RowContext = useMemo(() => ({ departments }), [departments])
  const hasFilters = !!params.search || params.status !== 'all' || Object.keys(params.filters).length > 0

  function clearFilters() {
    setDraft(null)
    update({ search: '', status: 'all', filters: {} })
  }

  async function handleDeactivate() {
    if (!toDeactivate) return
    setDeactivating(true)
    setDeactivateError('')
    try {
      await deactivateAdmin(resource.endpoint, toDeactivate.id)
      toast(`${resource.rowTitle(toDeactivate)} deactivated`)
      setToDeactivate(null)
      setRefresh(n => n + 1)
    } catch (err) {
      // e.g. 409 { errors: { role: ["3 active users hold this role"] } }
      const first = isApiError(err) ? Object.values(err.errors ?? {}).find(v => v?.[0])?.[0] : undefined
      setDeactivateError(first ?? safeErrorMessage(err))
    } finally {
      setDeactivating(false)
    }
  }

  async function handleReactivate(row: AdminRow) {
    setBusyId(row.id)
    try {
      await reactivateAdmin(resource.endpoint, row.id)
      toast(`${resource.rowTitle(row)} reactivated`)
      setRefresh(n => n + 1)
    } catch (err) {
      const first = isApiError(err) ? Object.values(err.errors ?? {}).find(v => v?.[0])?.[0] : undefined
      toast(first ?? safeErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell
      title={resource.title}
      subtitle={resource.description}
      back
      actions={
        blocked === 'forbidden' || (blocked === 'unavailable' && !resource.createWorksWithoutList) ? undefined : (
          <button type="button" onClick={() => setForm({ row: null })} className={btnPrimary}>
            <Plus size={14} aria-hidden="true" />
            Add {resource.singular}
          </button>
        )
      }
    >
      {me => (
        <>
          {!blocked && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-gray-500 sm:max-w-xs">
              Search
              <span className="relative">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={searchValue}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder={resource.searchPlaceholder}
                  className={`${input} pl-8`}
                />
              </span>
            </label>

            {filters.map(f => (
              <FilterSelect
                key={f.param}
                filter={f}
                value={params.filters[f.param] ?? ''}
                onChange={v => update({ filters: { ...params.filters, [f.param]: v } })}
              />
            ))}

            <div role="group" aria-label="Filter by status" className="flex items-center gap-1.5">
              {STATUS_PILLS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={params.status === p.value}
                  onClick={() => update({ status: p.value })}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    params.status === p.value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded pb-2 text-sm text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Clear filters
              </button>
            )}
          </div>
          )}

          {blocked === 'unavailable' ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              <EmptyState
                icon={Construction}
                title="Not available yet"
                description={
                  resource.createWorksWithoutList
                    ? `The list isn't enabled on the server yet, but you can still add a ${resource.singular}.`
                    : "This section isn't enabled on the server."
                }
              />
            </div>
          ) : blocked === 'forbidden' ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              <EmptyState
                icon={Lock}
                title={`You don't have access to ${resource.title.toLowerCase()}`}
                description="Ask an administrator if you think this is wrong."
              />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => setRefresh(n => n + 1)} />
          ) : loadingFirst ? (
            <TableSkeleton rows={8} columns={resource.columns.length + 2} />
          ) : data ? (
            <>
              <div
                className={`overflow-x-auto rounded-xl border border-gray-200 bg-white transition-opacity ${
                  stale ? 'opacity-60' : ''
                }`}
                aria-busy={stale}
              >
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      {resource.columns.map(c => (
                        <th key={c.header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                          {c.header}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.data.length === 0 ? (
                      <tr>
                        <td colSpan={resource.columns.length + 2}>
                          {hasFilters ? (
                            <EmptyState
                              icon={SearchX}
                              title={`No ${resource.title.toLowerCase()} match your filters`}
                              action={{ label: 'Clear filters', onClick: clearFilters }}
                            />
                          ) : (
                            <EmptyState
                              icon={Inbox}
                              title={`No ${resource.title.toLowerCase()} yet`}
                              action={{ label: `Add ${resource.singular}`, onClick: () => setForm({ row: null }) }}
                            />
                          )}
                        </td>
                      </tr>
                    ) : (
                      data.data.map(row => {
                        const active = row.status !== false
                        const lock = resource.lock?.(row, me) ?? null
                        const title = resource.rowTitle(row)
                        return (
                          <tr key={row.id} className="hover:bg-gray-50">
                            {resource.columns.map(c => (
                              <td key={c.header} className="px-4 py-3 text-gray-700">
                                {c.value(row, ctx) || <span className="text-gray-500">—</span>}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  active ? ACTIVE_BADGE : INACTIVE_BADGE
                                }`}
                              >
                                {active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!lock?.edit) setForm({ row })
                                  }}
                                  aria-disabled={!!lock?.edit}
                                  aria-describedby={lock?.edit ? `${uid}-edit-${row.id}` : undefined}
                                  title={lock?.edit}
                                  aria-label={`Edit ${resource.singular} ${title}`}
                                  className={`${btnSecondary} ${btnSm} ${lock?.edit ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  Edit
                                  {lock?.edit && (
                                    <span id={`${uid}-edit-${row.id}`} className="sr-only">
                                      {lock.edit}
                                    </span>
                                  )}
                                </button>
                                {active ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (lock?.deactivate) return
                                      setDeactivateError('')
                                      setToDeactivate(row)
                                    }}
                                    aria-disabled={!!lock?.deactivate}
                                    aria-describedby={lock?.deactivate ? `${uid}-deactivate-${row.id}` : undefined}
                                    title={lock?.deactivate}
                                    aria-label={`Deactivate ${resource.singular} ${title}`}
                                    className={`${btnDanger} ${btnSm} ${lock?.deactivate ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                    Deactivate
                                    {lock?.deactivate && (
                                      <span id={`${uid}-deactivate-${row.id}`} className="sr-only">
                                        {lock.deactivate}
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleReactivate(row)}
                                    disabled={busyId === row.id}
                                    aria-label={`Reactivate ${resource.singular} ${title}`}
                                    className={`${btnSuccess} ${btnSm}`}
                                  >
                                    {busyId === row.id ? 'Reactivating…' : 'Reactivate'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {data.last_page > 1 && (
                <Pagination
                  currentPage={data.current_page}
                  lastPage={data.last_page}
                  total={data.total}
                  noun={resource.title.toLowerCase()}
                  onPageChange={page => update({ page })}
                />
              )}
            </>
          ) : null}

          {form && (
            <AdminFormModal
              resource={resource}
              row={form.row}
              onClose={() => setForm(null)}
              onSaved={message => {
                toast(message)
                setForm(null)
                setRefresh(n => n + 1)
              }}
            />
          )}

          <ConfirmModal
            isOpen={!!toDeactivate}
            title={`Deactivate ${resource.singular}?`}
            message={`${toDeactivate ? resource.rowTitle(toDeactivate) : ''} will be hidden from lookups and can be reactivated later.${
              resource.deactivateNote ? ` ${resource.deactivateNote}` : ''
            }`}
            confirmLabel="Deactivate"
            variant="danger"
            loading={deactivating}
            error={deactivateError}
            onConfirm={handleDeactivate}
            onCancel={() => setToDeactivate(null)}
          />
        </>
      )}
    </AdminShell>
  )
}

function FilterSelect({
  filter,
  value,
  onChange,
}: {
  filter: NonNullable<AdminResource['filters']>[number]
  value: string
  onChange: (value: string) => void
}) {
  const { options, loading, error } = useOptions(filter.options, {})
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
      {filter.label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={loading}
        className={inputAuto}
      >
        <option value="">{filter.allLabel}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-xs font-normal text-red-600">
          Couldn&apos;t load {filter.label.toLowerCase()} options.
        </span>
      )}
    </label>
  )
}
