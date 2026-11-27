import { Archive } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Avatar } from '@renderer/components/Avatar'
import { EmberLogo } from '@renderer/components/EmberLogo'
import { Button } from '@renderer/components/ui/button'
import { dayGroup, shortTime } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailSummary } from '../../../shared/types'

interface InboxScreenProps {
  title: string
  mails: MailSummary[]
  accounts: AccountInfo[]
  loaded: boolean
  focusKey: string | null
  onOpen: (mail: MailSummary) => void
  onArchive: (mail: MailSummary) => void
  onAddAccount: () => void
}

export function InboxScreen({
  title,
  mails,
  accounts,
  loaded,
  focusKey,
  onOpen,
  onArchive,
  onAddAccount
}: InboxScreenProps): React.JSX.Element {
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const unread = mails.filter((m) => m.unread).length
  const focusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focusKey])

  const showDayFor = new Set(
    mails
      .filter((mail, i) => i === 0 || dayGroup(mail.date) !== dayGroup(mails[i - 1].date))
      .map((mail) => mail.key)
  )

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-end gap-4 border-b px-10 pt-7 pb-5">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {mails.length} {mails.length === 1 ? 'mail' : 'mails'} · {unread} unread
          </p>
        </div>
      </header>

      {accounts.length === 0 ? (
        <EmptyState
          title="Add your first account"
          text="Ember Mail works with any IMAP account. Your password is stored encrypted by Windows."
          action={<Button onClick={onAddAccount}>Add account</Button>}
        />
      ) : !loaded ? null : mails.length === 0 ? (
        <EmptyState
          title="Inbox zero"
          text="Everything is read and archived. Nothing was deleted."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-8">
          {mails.map((mail) => {
            const account = accountById.get(mail.accountId)
            const showDay = showDayFor.has(mail.key)
            const focused = mail.key === focusKey
            return (
              <div key={mail.key}>
                {showDay && (
                  <div className="px-4 pt-6 pb-2 text-xs font-medium text-muted-foreground">
                    {dayGroup(mail.date)}
                  </div>
                )}
                <div
                  ref={focused ? focusRef : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${mail.fromName}: ${mail.subject}`}
                  onClick={() => onOpen(mail)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(mail)}
                  className={cn(
                    'group relative flex cursor-pointer items-start gap-4 rounded-lg px-4 py-4 transition-colors hover:bg-accent',
                    focused && 'bg-accent ring-1 ring-border ring-inset'
                  )}
                >
                  <Avatar
                    name={mail.fromName}
                    colorIndex={account?.colorIndex}
                    accountName={account?.name}
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'truncate text-[15px]',
                          mail.unread ? 'font-semibold' : 'font-medium text-muted-foreground'
                        )}
                      >
                        {mail.fromName}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums group-hover:invisible">
                        {shortTime(mail.date)}
                      </span>
                    </div>
                    <div className={cn('truncate text-[15px]', mail.unread && 'font-semibold')}>
                      {mail.unread && (
                        <span className="mr-2 inline-block size-2 -translate-y-px rounded-full bg-primary" />
                      )}
                      {mail.subject}
                    </div>
                    <div className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {mail.preview}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 hidden gap-1 group-hover:flex">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      title="Archive (E)"
                      aria-label="Archive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onArchive(mail)
                      }}
                    >
                      <Archive />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

function EmptyState({
  title,
  text,
  action
}: {
  title: string
  text: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid flex-1 animate-in place-content-center justify-items-center gap-3 text-center fade-in">
      <EmberLogo size={72} />
      <p className="text-2xl font-semibold tracking-tight">{title}</p>
      <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}
