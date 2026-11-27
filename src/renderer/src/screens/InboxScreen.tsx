import { Archive, CalendarDays, Inbox, LoaderCircle, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Avatar } from '@renderer/components/Avatar'
import { EmberLogo } from '@renderer/components/EmberLogo'
import { UrgencyBadge } from '@renderer/components/UrgencyBadge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import type { ArchiveList } from '@renderer/hooks/useArchive'
import { dayGroup, localDay, mailDateLabel, monthGroup, shortTime } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailFolder, MailSummary } from '../../../shared/types'

interface InboxScreenProps {
  title: string
  folder: MailFolder
  mails: MailSummary[]
  accounts: AccountInfo[]
  loaded: boolean
  /** Search and paging, only in the archive view. */
  archive?: ArchiveList
  focusKey: string | null
  onOpen: (mail: MailSummary) => void
  /** Archives an inbox mail, or moves an archived mail back to the inbox. */
  onToggleArchive: (mail: MailSummary) => void
  onAddAccount: () => void
  /** Shown in the inbox when Claude is set up. */
  onCleanInbox?: () => Promise<void>
}

/** The mail list, for the inboxes and for the archive. */
export function InboxScreen({
  title,
  folder,
  mails,
  accounts,
  loaded,
  archive,
  focusKey,
  onOpen,
  onToggleArchive,
  onAddAccount,
  onCleanInbox
}: InboxScreenProps): React.JSX.Element {
  const inArchive = folder === 'archive'
  const group = inArchive ? monthGroup : dayGroup
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const unread = mails.filter((m) => m.unread).length
  const focusRef = useRef<HTMLDivElement>(null)
  const today = localDay()
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focusKey])

  const showDayFor = new Set(
    mails
      .filter((mail, i) => i === 0 || group(mail.date) !== group(mails[i - 1].date))
      .map((mail) => mail.key)
  )

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline/[.06] bg-background/70">
      {/* One scroller: the frosted header sticks on top and rows scroll beneath it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline/[.07] bg-glass/55 px-8 py-3 backdrop-blur-2xl backdrop-saturate-150">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            <p className="shrink-0 text-[13px] text-muted-foreground">
              {inArchive
                ? archive?.query.trim()
                  ? `${mails.length}${archive.hasMore ? '+' : ''} found`
                  : `${mails.length}${archive?.hasMore ? '+' : ''} archived ${mails.length === 1 ? 'mail' : 'mails'}`
                : `${mails.length} ${mails.length === 1 ? 'mail' : 'mails'} · ${unread} unread`}
            </p>
          </div>
          {archive && accounts.length > 0 && (
            <div className="relative ml-auto w-64">
              {archive.loading ? (
                <LoaderCircle className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                value={archive.query}
                onChange={(e) => archive.setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && archive.setQuery('')}
                placeholder="Search the archive"
                aria-label="Search the archive"
                className="h-8 rounded-full border-hairline/10 bg-glass/50 pr-8 pl-9 backdrop-blur-xl"
              />
              {archive.query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => archive.setQuery('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {!inArchive && onCleanInbox && mails.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={cleaning}
              onClick={() => {
                setCleaning(true)
                void onCleanInbox().finally(() => setCleaning(false))
              }}
            >
              {cleaning ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Sparkles className="text-primary" />
              )}
              Clean inbox
            </Button>
          )}
        </header>

        {accounts.length === 0 ? (
          <EmptyState
            title="Add your first account"
            text="Ember Mail works with any IMAP account. Your password is stored encrypted by Windows."
            action={<Button onClick={onAddAccount}>Add account</Button>}
          />
        ) : archive?.error && mails.length === 0 ? (
          <EmptyState
            title="The archive didn't load"
            text={archive.error}
            action={<Button onClick={archive.reload}>Try again</Button>}
          />
        ) : !loaded ? null : mails.length === 0 ? (
          inArchive ? (
            <EmptyState
              title={archive?.query.trim() ? 'Nothing found' : 'The archive is empty'}
              text={
                archive?.query.trim()
                  ? 'No archived mail matches. The search looks at sender, subject and text.'
                  : 'Mail you archive lands here, and you can move it back to the inbox any time.'
              }
            />
          ) : (
            <EmptyState
              title="Inbox zero"
              text="Everything is read and archived. Nothing was deleted."
            />
          )
        ) : (
          <div className="px-4 pb-8">
            {mails.map((mail) => {
              const account = accountById.get(mail.accountId)
              const showDay = showDayFor.has(mail.key)
              const focused = mail.key === focusKey
              const nextDate = mail.analysis?.dates.find((d) => d.date >= today)
              return (
                <div key={mail.key}>
                  {showDay && (
                    <div className="px-4 pt-5 pb-2 text-[11px] font-medium tracking-[.08em] text-muted-foreground/80 uppercase">
                      {group(mail.date)}
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
                      'group relative flex cursor-pointer items-start gap-4 rounded-2xl px-4 py-4 transition-colors outline-none hover:bg-hairline/[.05] focus-visible:ring-2 focus-visible:ring-ring',
                      focused &&
                        'bg-hairline/[.07] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--hairline)_6%,transparent)]'
                    )}
                  >
                    <Avatar
                      name={mail.fromName}
                      address={mail.fromAddress}
                      colorIndex={account?.colorIndex}
                      accountName={account?.name}
                    />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'truncate text-[15px]',
                            mail.unread ? 'font-semibold' : 'font-medium text-foreground/75'
                          )}
                        >
                          {mail.fromName}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums group-hover:invisible">
                          {shortTime(mail.date)}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        {mail.unread && (
                          <span className="inline-block size-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                        )}
                        <UrgencyBadge analysis={mail.analysis} />
                        <span
                          className={cn(
                            'truncate text-[15px]',
                            mail.unread ? 'font-semibold' : 'text-foreground/90'
                          )}
                        >
                          {mail.subject}
                        </span>
                      </div>
                      {mail.analysis ? (
                        <div className="flex min-w-0 items-center gap-2 text-sm leading-relaxed text-muted-foreground">
                          <span className="truncate">{mail.analysis.summary}</span>
                          {nextDate && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline/10 bg-hairline/[.04] px-2 py-px text-xs">
                              <CalendarDays className="size-3" />
                              {mailDateLabel(nextDate.date, nextDate.time)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {mail.preview}
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 hidden gap-1 group-hover:flex">
                      <Button
                        variant="outline"
                        size={inArchive ? 'sm' : 'icon'}
                        className={inArchive ? 'h-8 text-xs' : 'size-8'}
                        title={inArchive ? 'Move to inbox (E)' : 'Archive (E)'}
                        aria-label={inArchive ? 'Move to inbox' : 'Archive'}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleArchive(mail)
                        }}
                      >
                        {inArchive ? (
                          <>
                            <Inbox /> Move to inbox
                          </>
                        ) : (
                          <Archive />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
            {archive?.hasMore && (
              <div className="grid place-items-center pt-6">
                <Button variant="outline" disabled={archive.loading} onClick={archive.loadMore}>
                  {archive.loading && <LoaderCircle className="animate-spin" />}
                  Load older mail
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
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
    <div className="grid flex-1 animate-in place-content-center justify-items-center gap-3 py-16 text-center fade-in">
      <div className="relative grid place-items-center">
        <div className="absolute size-40 rounded-full bg-primary/25 blur-3xl" />
        <EmberLogo size={72} className="relative" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{title}</p>
      <p className="max-w-[36ch] text-sm leading-relaxed text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}
