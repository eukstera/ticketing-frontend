'use client'

import { useEffect, useState } from 'react'
import { api, getErrorMessage, isAbortError } from '@/lib/api'
import { toPaginator } from '@/lib/admin'
import type { OptionsSource } from '@/lib/adminResources'

export interface Option {
  value: string
  label: string
}

// Loads the options for a <select> from an admin/lookup endpoint. Re-fetches
// when the resolved URL changes (dependent selects). `loading` is derived from
// the URL the loaded options belong to, so no state is set synchronously
// inside the effect.
export function useOptions(source: OptionsSource | undefined, values: Record<string, string>) {
  const url = source ? source.endpoint(values) : null
  const [loaded, setLoaded] = useState<{ url: string; options: Option[]; error: string } | null>(null)

  useEffect(() => {
    if (!source || !url) return
    const controller = new AbortController()
    api
      .get<{ result: Record<string, unknown> }>(url, { signal: controller.signal })
      .then(res => {
        const rows = toPaginator<Record<string, unknown>>(res.result?.[source.resultKey]).data
        setLoaded({
          url,
          error: '',
          options: rows.map(r => ({
            value: String(r[source.valueKey]),
            label: String(r[source.labelKey] ?? ''),
          })),
        })
      })
      .catch(err => {
        if (isAbortError(err)) return
        setLoaded({ url, options: [], error: getErrorMessage(err, "Couldn't load options.") })
      })
    return () => controller.abort()
    // `source` is a module-level config object, so `url` is the real dependency.
  }, [source, url])

  const ready = !!url && loaded?.url === url
  return {
    waiting: !url,
    loading: !!url && !ready,
    options: ready ? loaded.options : [],
    error: ready ? loaded.error : '',
  }
}
