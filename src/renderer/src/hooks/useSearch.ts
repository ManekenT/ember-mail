import { useCallback, useRef, useState } from 'react'

import { cleanError } from '@renderer/lib/errors'
import type { MailSummary } from '../../../shared/types'

/** How many of the found mails Claude reads for an answer (ANSWER_MAILS in the main process). */
const ANSWER_MAILS = 25

export interface SearchState {
  /** What was searched last. */
  query: string
  status: 'idle' | 'searching' | 'answering' | 'done'
  mails: MailSummary[]
  /** Keys of the mails Claude read, in the order it numbers them ([1] is the first). */
  sources: string[]
  /** Claude's answer so far; null when the search wasn't a question. */
  answer: string | null
  error: string | null
  answerError: string | null
}

const EMPTY: SearchState = {
  query: '',
  status: 'idle',
  mails: [],
  sources: [],
  answer: null,
  error: null,
  answerError: null
}

export interface MailSearch extends SearchState {
  run: (query: string) => Promise<void>
  /** Takes a mail out of the results (it was archived or moved back to the inbox). */
  drop: (key: string) => void
  reset: () => void
}

/** Searches all accounts; questions also get an answer from Claude. */
export function useSearch(): MailSearch {
  const [state, setState] = useState<SearchState>(EMPTY)
  /** Only the newest request may change the state. */
  const current = useRef('')

  const run = useCallback(async (query: string) => {
    const text = query.trim()
    if (!text) return
    const requestId = crypto.randomUUID()
    current.current = requestId
    const update = (patch: Partial<SearchState>): void => {
      if (current.current === requestId) setState((s) => ({ ...s, ...patch }))
    }
    setState({ ...EMPTY, query: text, status: 'searching' })

    let result
    try {
      result = await window.api.searchMail(text)
    } catch (e) {
      update({ status: 'done', error: cleanError(e as Error) })
      return
    }
    if (!result.answer) {
      update({ status: 'done', mails: result.mails })
      return
    }

    const sources = result.mails.slice(0, ANSWER_MAILS).map((m) => m.key)
    update({ status: 'answering', mails: result.mails, sources, answer: '' })
    const stop = window.api.onAnswerText(
      (id, partial) => id === requestId && update({ answer: partial })
    )
    try {
      const answer = await window.api.askMailbox(requestId, text, sources)
      update({ status: 'done', answer })
    } catch (e) {
      update({ status: 'done', answerError: cleanError(e as Error) })
    } finally {
      stop()
    }
  }, [])

  const drop = useCallback(
    (key: string) => setState((s) => ({ ...s, mails: s.mails.filter((m) => m.key !== key) })),
    []
  )

  const reset = useCallback(() => {
    current.current = ''
    setState(EMPTY)
  }, [])

  return { ...state, run, drop, reset }
}
