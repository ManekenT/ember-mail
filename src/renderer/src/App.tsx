import { useCallback, useEffect, useMemo, useState } from 'react'

import { AddAccountDialog } from '@renderer/components/AddAccountDialog'
import { Sidebar } from '@renderer/components/Sidebar'
import { TitleBar } from '@renderer/components/TitleBar'
import { Toast, type ToastMessage } from '@renderer/components/Toast'
import { useArchive } from '@renderer/hooks/useArchive'
import { useMailbox } from '@renderer/hooks/useMailbox'
import { InboxScreen } from '@renderer/screens/InboxScreen'
import { cleanError } from '@renderer/lib/errors'
import { MailScreen } from '@renderer/screens/MailScreen'
import type { AccountInfo, MailFolder, MailSummary } from '../../shared/types'

function App(): React.JSX.Element {
  const mailbox = useMailbox()
  const { accounts, inbox, hide, refresh } = mailbox

  const [folder, setFolder] = useState<MailFolder>('inbox')
  const [selected, setSelected] = useState('all')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const archived = useArchive(folder === 'archive')
  const { remove: removeArchived, reload: reloadArchived } = archived
  const source = folder === 'archive' ? archived.mails : inbox

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const visible = useMemo(
    () => source.filter((m) => selected === 'all' || m.accountId === selected),
    [source, selected]
  )
  const openMail = openKey ? (source.find((m) => m.key === openKey) ?? null) : null
  const accountName = selected === 'all' ? null : (accountById.get(selected)?.name ?? null)
  const title =
    folder === 'archive'
      ? accountName
        ? `${accountName} · Archive`
        : 'Archive'
      : (accountName ?? 'All inboxes')

  const showToast = useCallback((text: string, onUndo?: () => void) => {
    setToast({ id: Date.now(), text, onUndo })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const open = useCallback((mail: MailSummary) => {
    setOpenKey(mail.key)
    setFocusKey(mail.key)
  }, [])

  const back = useCallback(() => setOpenKey(null), [])

  /** Like Spark: focus moves to the next mail, and a mail that was open closes. */
  const stepPast = useCallback(
    (mail: MailSummary) => {
      const index = visible.findIndex((m) => m.key === mail.key)
      const next = visible[index + 1] ?? visible[index - 1] ?? null
      setFocusKey(next?.key ?? null)
      if (openKey === mail.key) setOpenKey(null)
    },
    [visible, openKey]
  )

  const archive = useCallback(
    async (mail: MailSummary) => {
      stepPast(mail)
      hide(mail.key)

      const account = accountById.get(mail.accountId)
      try {
        const archivedUid = await window.api.archiveMail(mail.accountId, mail.uid)
        const undo =
          archivedUid === null
            ? undefined
            : () => {
                window.api
                  .moveToInbox(mail.accountId, archivedUid)
                  .then(() => showToast('Moved back to the inbox'))
                  .catch((e: Error) => showToast(cleanError(e)))
              }
        showToast(`Archived to ${account?.name ?? 'account'} › Archive`, undo)
      } catch (e) {
        showToast(cleanError(e as Error))
        void refresh()
      }
    },
    [stepPast, hide, accountById, showToast, refresh]
  )

  const moveToInbox = useCallback(
    async (mail: MailSummary) => {
      stepPast(mail)
      removeArchived(mail.key)

      const account = accountById.get(mail.accountId)
      try {
        const inboxUid = await window.api.moveToInbox(mail.accountId, mail.uid)
        const undo =
          inboxUid === null
            ? undefined
            : () => {
                window.api
                  .archiveMail(mail.accountId, inboxUid)
                  .then(() => {
                    showToast('Archived again')
                    reloadArchived()
                  })
                  .catch((e: Error) => showToast(cleanError(e)))
              }
        showToast(`Moved to ${account?.name ?? 'account'} › Inbox`, undo)
      } catch (e) {
        showToast(cleanError(e as Error))
        reloadArchived()
      }
    },
    [stepPast, removeArchived, reloadArchived, accountById, showToast]
  )

  /** E: archive in the inbox, move back to the inbox in the archive. */
  const toggleArchive = useCallback(
    (mail: MailSummary) => void (mail.folder === 'archive' ? moveToInbox(mail) : archive(mail)),
    [archive, moveToInbox]
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
        setFolder('inbox')
        setSelected('all')
        const key = `${accountId}:inbox:${uid}`
        setOpenKey(key)
        setFocusKey(key)
      }),
    []
  )

  // Keyboard: J/K move, Enter open, Esc back, E archive (or move back to the inbox).
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
      else if (key === 'e' && index >= 0) toggleArchive(visible[index])
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addOpen, openKey, focusKey, visible, open, back, toggleArchive])

  return (
    <div className="ambient flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <Sidebar
          accounts={accounts}
          statuses={mailbox.statuses}
          inbox={inbox}
          folder={folder}
          selected={selected}
          onSelectFolder={(next) => {
            setFolder(next)
            setSelected('all')
            setOpenKey(null)
            setFocusKey(null)
          }}
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
            onBack={back}
            onToggleArchive={toggleArchive}
          />
        ) : (
          <InboxScreen
            title={title}
            folder={folder}
            mails={visible}
            accounts={accounts}
            loaded={
              folder === 'archive' ? !archived.loading || archived.mails.length > 0 : mailbox.loaded
            }
            archive={folder === 'archive' ? archived : undefined}
            focusKey={focusKey}
            onOpen={open}
            onToggleArchive={toggleArchive}
            onAddAccount={() => setAddOpen(true)}
          />
        )}
      </div>

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onAdded={() => void refresh()} />
      <Toast key={toast?.id} toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

export default App
