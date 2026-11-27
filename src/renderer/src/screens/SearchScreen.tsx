import { Archive, LoaderCircle, Search, Send, Sparkles, X } from 'lucide-react'
import { Fragment, useState } from 'react'

import { Avatar } from '@renderer/components/Avatar'
import { UrgencyBadge } from '@renderer/components/UrgencyBadge'
import type { MailSearch } from '@renderer/hooks/useSearch'
import { shortTime } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailSummary } from '../../../shared/types'

interface SearchScreenProps {
  search: MailSearch
  accounts: AccountInfo[]
  hasClaude: boolean
  onOpen: (mail: MailSummary) => void
  onClose: () => void
}

/** Search across all accounts and folders; a question also gets Claude's answer. */
export function SearchScreen({
  search,
  accounts,
  hasClaude,
  onOpen,
  onClose
}: SearchScreenProps): React.JSX.Element {
  const [text, setText] = useState(search.query)
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const busy = search.status === 'searching'
  const mailByKey = new Map(search.mails.map((m) => [m.key, m]))

  // Once the answer is there, the mails it cites come first.
  const cited = search.answer ? citedKeys(search.answer, search.sources) : []
  const citedMails = cited.flatMap((key) => mailByKey.get(key) ?? [])
  const otherMails = search.mails.filter((m) => !cited.includes(m.key))

  const row = (mail: MailSummary): React.JSX.Element => (
    <ResultRow
      key={mail.key}
      mail={mail}
      account={accountById.get(mail.accountId)}
      onOpen={() => onOpen(mail)}
    />
  )

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline/[.06] bg-background/70">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <header className="sticky top-0 z-10 border-b border-hairline/[.07] bg-glass/55 px-8 py-4 backdrop-blur-2xl backdrop-saturate-150">
          <form
            className="relative mx-auto max-w-[760px]"
            onSubmit={(e) => {
              e.preventDefault()
              void search.run(text)
            }}
          >
            {busy ? (
              <LoaderCircle className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : (
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  onClose()
                }
              }}
              placeholder={hasClaude ? 'Search or ask your mailbox' : 'Search all accounts'}
              aria-label="Search"
              className="h-12 w-full rounded-2xl border border-hairline/10 bg-hairline/[.04] pr-12 pl-12 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              aria-label="Close search"
              title="Close (Esc)"
              onClick={onClose}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-hairline/[.06] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </form>
        </header>

        <div className="mx-auto grid w-full max-w-[808px] gap-4 px-4 pt-5 pb-8">
          {search.error && <p className="px-4 text-sm text-destructive">{search.error}</p>}

          {(search.answer !== null || search.answerError) && (
            <AnswerCard
              answer={search.answer ?? ''}
              error={search.answerError}
              writing={search.status === 'answering'}
              sources={search.sources}
              mailByKey={mailByKey}
              onOpen={onOpen}
            />
          )}

          {search.status === 'done' && !search.error && search.mails.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing found.</p>
          )}

          {citedMails.length > 0 ? (
            <>
              <Group label="Sources">{citedMails.map(row)}</Group>
              {otherMails.length > 0 && <Group label="Other mails">{otherMails.map(row)}</Group>}
            </>
          ) : (
            search.mails.length > 0 && <div>{search.mails.map(row)}</div>
          )}
        </div>
      </div>
    </main>
  )
}

/** The mail keys an answer cites as [n], in order of first mention. */
function citedKeys(answer: string, sources: string[]): string[] {
  const keys: string[] = []
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const key = sources[Number(match[1]) - 1]
    if (key && !keys.includes(key)) keys.push(key)
  }
  return keys
}

function AnswerCard({
  answer,
  error,
  writing,
  sources,
  mailByKey,
  onOpen
}: {
  answer: string
  error: string | null
  writing: boolean
  sources: string[]
  mailByKey: Map<string, MailSummary>
  onOpen: (mail: MailSummary) => void
}): React.JSX.Element {
  // "[2]" becomes a chip naming the mail; it opens that mail.
  const parts = answer.split(/(\[\d+\])/g)
  return (
    <section className="sheen animate-in rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.10] to-transparent p-5 backdrop-blur-xl fade-in">
      <div className="flex gap-3">
        <Sparkles className="mt-1 size-4 shrink-0 text-primary" />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !answer && writing ? (
          <p className="text-[15px] text-muted-foreground">Reading the mails…</p>
        ) : (
          <p className="text-[15px] leading-7 whitespace-pre-wrap">
            {parts.map((part, i) => {
              const n = part.match(/^\[(\d+)\]$/)?.[1]
              if (!n) return <Fragment key={i}>{part}</Fragment>
              const mail = mailByKey.get(sources[Number(n) - 1] ?? '')
              if (!mail) return null
              return (
                <button
                  key={i}
                  type="button"
                  title={mail.subject}
                  onClick={() => onOpen(mail)}
                  className="mx-0.5 inline-flex max-w-[18ch] translate-y-[-1px] items-center truncate rounded-full border border-hairline/10 bg-hairline/[.06] px-2 align-middle text-xs leading-5 text-muted-foreground hover:bg-hairline/[.12] hover:text-foreground"
                >
                  {mail.folder === 'sent' ? `To ${mail.toName || 'you'}` : mail.fromName}
                </button>
              )
            })}
            {writing && (
              <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70" />
            )}
          </p>
        )}
      </div>
    </section>
  )
}

function Group({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="px-4 pt-2 pb-2 text-[11px] font-medium tracking-[.08em] text-muted-foreground/80 uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

function ResultRow({
  mail,
  account,
  onOpen
}: {
  mail: MailSummary
  account: AccountInfo | undefined
  onOpen: () => void
}): React.JSX.Element {
  const sent = mail.folder === 'sent'
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${mail.fromName}: ${mail.subject}`}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group flex cursor-pointer items-start gap-4 rounded-2xl px-4 py-3.5 transition-colors outline-none hover:bg-hairline/[.05] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar
        name={sent ? mail.toName || mail.fromName : mail.fromName}
        address={sent ? undefined : mail.fromAddress}
        colorIndex={account?.colorIndex}
        accountName={account?.name}
        size={40}
      />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn('truncate text-[15px]', mail.unread ? 'font-semibold' : 'font-medium')}
          >
            {sent ? `To ${mail.toName || 'unknown'}` : mail.fromName}
          </span>
          {mail.folder !== 'inbox' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline/10 bg-hairline/[.04] px-2 py-px text-[11px] text-muted-foreground">
              {sent ? <Send className="size-3" /> : <Archive className="size-3" />}
              {sent ? 'Sent' : 'Archive'}
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {shortTime(mail.date)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <UrgencyBadge analysis={mail.analysis} />
          <span className="truncate text-[15px] text-foreground/90">{mail.subject}</span>
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {mail.analysis?.summary ?? mail.preview}
        </div>
      </div>
    </div>
  )
}
