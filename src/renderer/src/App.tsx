import { useCallback, useEffect, useMemo, useState } from 'react'

import { AddAccountDialog } from '@renderer/components/AddAccountDialog'
import { Sidebar } from '@renderer/components/Sidebar'
import { Toast, type ToastMessage } from '@renderer/components/Toast'
import { useMailbox } from '@renderer/hooks/useMailbox'
import { InboxScreen } from '@renderer/screens/InboxScreen'
import { cleanError } from '@renderer/lib/errors'
import { MailScreen } from '@renderer/screens/MailScreen'
import type { AccountInfo, MailSummary } from '../../shared/types'

function App(): React.JSX.Element {
  const mailbox = useMailbox()
  const { accounts, inbox, hide, refresh } = mailbox

  const [selected, setSelected] = useState('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const visible = useMemo(
    () => inbox.filter((m) => selected === 'all' || m.accountId === selected),
    [inbox, selected]
  )
  const openMail = openKey ? (inbox.find((m) => m.key === openKey) ?? null) : null
  const title = selected === 'all' ? 'All inboxes' : (accountById.get(selected)?.name ?? 'Inbox')

  const showToast = useCallback((text: string, onUndo?: () => void) => {
    setToast({ id: Date.now(), text, onUndo })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const open = useCallback((mail: MailSummary) => {
    setOpenKey(mail.key)
    setFocusKey(mail.key)
  }, [])

  const back = useCallback(() => setOpenKey(null), [])

  const archive = useCallback(
    async (mail: MailSummary) => {
      // Move focus to the next mail, like Spark; archiving an open mail returns to the list.
      const index = visible.findIndex((m) => m.key === mail.key)
      const next = visible[index + 1] ?? visible[index - 1] ?? null
      setFocusKey(next?.key ?? null)
      if (openKey === mail.key) setOpenKey(null)
      hide(mail.key)

      const account = accountById.get(mail.accountId)
      try {
        const archivedUid = await window.api.archiveMail(mail.accountId, mail.uid)
        const undo =
          archivedUid === null
            ? undefined
            : () => {
                window.api
                  .undoArchive(mail.accountId, archivedUid)
                  .then(() => showToast('Moved back to the inbox'))
                  .catch((e: Error) => showToast(cleanError(e)))
              }
        showToast(`Archived to ${account?.name ?? 'account'} › Archive`, undo)
      } catch (e) {
        showToast(cleanError(e as Error))
        void refresh()
      }
    },
    [visible, openKey, hide, accountById, showToast, refresh]
  )

  const removeAccount = useCallback(
    async (account: AccountInfo) => {
      if (!window.confirm(`Remove ${account.name} from Ember Mail? Your mail stays on the server.`))
        return
      await window.api.removeAccount(account.id)
      if (selected === account.id) setSelected('all')
      await refresh()
    },
    [selected, refresh]
  )

  // Notification click → open that mail.
  useEffect(
    () =>
      window.api.onOpenMail((accountId, uid) => {
        setSelected('all')
        const key = `${accountId}:${uid}`
        setOpenKey(key)
        setFocusKey(key)
      }),
    []
  )

  // Keyboard: J/K move, Enter open, Esc back, E archive.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (addOpen || target.closest('input, textarea, select, [role="dialog"]')) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const currentKey = openKey ?? focusKey
      const index = visible.findIndex((m) => m.key === currentKey)
      const key = event.key.toLowerCase()

      if (key === 'escape' && openKey) back()
      else if (key === 'j' || key === 'arrowdown') {
        const next = visible[index + 1] ?? (index < 0 ? visible[0] : undefined)
        if (next) (openKey ? open : (m: MailSummary) => setFocusKey(m.key))(next)
      } else if (key === 'k' || key === 'arrowup') {
        const prev = visible[index - 1]
        if (prev) (openKey ? open : (m: MailSummary) => setFocusKey(m.key))(prev)
      } else if (key === 'enter' && !openKey && index >= 0) open(visible[index])
      else if (key === 'e' && index >= 0) void archive(visible[index])
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addOpen, openKey, focusKey, visible, open, back, archive])

  return (
    <div className="flex h-full">
      <Sidebar
        accounts={accounts}
        statuses={mailbox.statuses}
        inbox={inbox}
        selected={selected}
        onSelect={(id) => {
          setSelected(id)
          setOpenKey(null)
        }}
        onAddAccount={() => setAddOpen(true)}
        onRemoveAccount={(account) => void removeAccount(account)}
      />

      {openMail ? (
        <MailScreen
          mail={openMail}
          account={accountById.get(openMail.accountId)}
          position={{
            index: Math.max(
              0,
              visible.findIndex((m) => m.key === openMail.key)
            ),
            total: visible.length
          }}
          onBack={back}
          onArchive={(m) => void archive(m)}
        />
      ) : (
        <InboxScreen
          title={title}
          mails={visible}
          accounts={accounts}
          loaded={mailbox.loaded}
          focusKey={focusKey}
          onOpen={open}
          onArchive={(m) => void archive(m)}
          onAddAccount={() => setAddOpen(true)}
        />
      )}

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void refresh()} />
      <Toast key={toast?.id} toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

export default App
