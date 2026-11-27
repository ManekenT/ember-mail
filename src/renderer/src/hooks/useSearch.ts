import { useCallback, useRef, useState } from 'react'

import { cleanError } from '@renderer/lib/errors'
import type { MailSummary } from '../../../shared/types'

export interface SearchState {
  /** What was searched last. */
  query: string
  status: 'idle' | 'searching' | 'done'
  mails: MailSummary[]
  error: string | null
}

const EMPTY: SearchState = { query: '', status: 'idle', mails: [], error: null }

export interface MailSearch extends SearchState {
  run: (query: string) => Promise<void>
  /** Takes a mail out of the results (it was archived or moved back to the inbox). */
  drop: (key: string) => void
}

/** Searches Inbox, Archive and Sent of all accounts on the server. */
export function useSearch(): MailSearch {
  const [state, setState] = useState<SearchState>(EMPTY)
  /** Only the newest request may change the state. */
  const current = useRef(0)

  const run = useCallback(async (query: string) => {
    const text = query.trim()
    if (!text) return
    const request = ++current.current
    setState({ ...EMPTY, query: text, status: 'searching' })
    try {
      const result = await window.api.searchMail(text)
      if (current.current === request)
        setState({ ...EMPTY, query: text, status: 'done', mails: result.mails })
    } catch (e) {
      if (current.current === request) {
        setState({ ...EMPTY, query: text, status: 'done', error: cleanError(e as Error) })
      }
    }
  }, [])

  const drop = useCallback(
    (key: string) => setState((s) => ({ ...s, mails: s.mails.filter((m) => m.key !== key) })),
    []
  )

  return { ...state, run, drop }
}
