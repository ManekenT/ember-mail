import { useCallback, useEffect, useRef, useState } from 'react'

import { cleanError } from '@renderer/lib/errors'
import type { MailSummary } from '../../../shared/types'

const PAGE_SIZE = 100
/** Wait this long after the last keystroke before searching the server. */
const SEARCH_DELAY_MS = 350

export interface ArchiveList {
  mails: MailSummary[]
  loading: boolean
  hasMore: boolean
  error: string | null
  query: string
  setQuery: (query: string) => void
  loadMore: () => void
  reload: () => void
  /** Hides a mail right away while it moves back to the inbox. */
  remove: (key: string) => void
}

/**
 * The combined Archive folders, loaded from the server while the archive view is open.
 * It is fetched fresh each time the view opens, so mail archived meanwhile shows up.
 */
export function useArchive(active: boolean): ArchiveList {
  const [mails, setMails] = useState<MailSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [version, setVersion] = useState(0)
  const request = useRef(0)

  // Debounce typing into a server search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setLimit(PAGE_SIZE)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!active) return
    const id = ++request.current
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    window.api
      .listArchive(limit, search || undefined)
      .then((page) => {
        if (id !== request.current) return
        setMails(page.mails)
        setHasMore(page.hasMore)
      })
      .catch((e: Error) => id === request.current && setError(cleanError(e)))
      .finally(() => id === request.current && setLoading(false))
  }, [active, limit, search, version])

  // Leaving the view resets it, so the next visit starts at the newest mail.
  useEffect(() => {
    if (active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLimit(PAGE_SIZE)
    setQuery('')
    setSearch('')
  }, [active])

  const loadMore = useCallback(() => setLimit((current) => current + PAGE_SIZE), [])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const remove = useCallback((key: string) => {
    setMails((current) => current.filter((m) => m.key !== key))
  }, [])

  return { mails, loading, hasMore, error, query, setQuery, loadMore, reload, remove }
}
