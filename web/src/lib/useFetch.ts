// Minimal on-mount fetch hook for the analytics + sessions views. Kept separate
// from useOpses (the org-wide live/sample data source) so those views can fetch
// their own endpoints and degrade gracefully without touching the shared layer.
// Pass a *stable* fetcher (the module-level api clients qualify).
import { useCallback, useEffect, useState } from 'react'

export type FetchStatus = 'loading' | 'ready' | 'error'

export interface FetchResult<T> {
  status: FetchStatus
  /** Last successful payload; retained across refetches and on error. */
  data: T | null
  refetch: () => void
}

export function useFetch<T>(fetcher: () => Promise<T>): FetchResult<T> {
  const [state, setState] = useState<{ status: FetchStatus; data: T | null }>({
    status: 'loading',
    data: null,
  })

  const load = useCallback(() => {
    let cancelled = false
    setState((s) => ({ status: 'loading', data: s.data }))
    fetcher()
      .then((d) => {
        if (!cancelled) setState({ status: 'ready', data: d })
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ status: 'error', data: s.data }))
      })
    return () => {
      cancelled = true
    }
  }, [fetcher])

  useEffect(() => load(), [load])

  return { status: state.status, data: state.data, refetch: load }
}
