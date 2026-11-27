import { useCallback, useEffect, useState } from 'react'

import type { AccountInfo, AccountStatus, MailSummary } from '../../../shared/types'

export interface Mailbox {
  accounts: AccountInfo[]
  statuses: Record<string, AccountStatus>
  inbox: MailSummary[]
  loaded: boolean
  refresh: () => Promise<void>
  /** Hides a mail right away while the server moves it. */
  hide: (key: string) => void
}

/** Accounts, connection states and the combined inbox, kept live from the main process. */
export function useMailbox(): Mailbox {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [statuses, setStatuses] = useState<Record<string, AccountStatus>>({})
  const [inbox, setInbox] = useState<MailSummary[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [nextAccounts, nextStatuses, nextInbox] = await Promise.all([
      window.api.listAccounts(),
      window.api.getStatuses(),
      window.api.listInbox()
    ])
    setAccounts(nextAccounts)
    setStatuses(nextStatuses)
    setInbox(nextInbox)
    // Forget optimistic hides once the server agrees.
    setHidden((current) => {
      const keys = new Set(nextInbox.map((m) => m.key))
      return new Set([...current].filter((key) => keys.has(key)))
    })
    setLoaded(true)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    return window.api.onInboxChanged(() => void refresh())
  }, [refresh])

  const hide = useCallback((key: string) => {
    setHidden((current) => new Set(current).add(key))
  }, [])

  return {
    accounts,
    statuses,
    inbox: inbox.filter((m) => !hidden.has(m.key)),
    loaded,
    refresh,
    hide
  }
}
