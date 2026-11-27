import { Archive, ChevronLeft, FileCode, Inbox, Reply, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AnalysisCard } from '@renderer/components/AnalysisCard'
import { Avatar } from '@renderer/components/Avatar'
import { Kbd } from '@renderer/components/Kbd'
import { MailBody } from '@renderer/components/MailBody'
import { SourceDialog } from '@renderer/components/SourceDialog'
import { Button } from '@renderer/components/ui/button'
import { cleanError } from '@renderer/lib/errors'
import { accountDot, longDate } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailDetail, MailSummary } from '../../../shared/types'

interface MailScreenProps {
  mail: MailSummary
  account: AccountInfo | undefined
  onBack: () => void
  /** Archives an inbox mail, or moves an archived mail back to the inbox. */
  onToggleArchive: (mail: MailSummary) => void
  hasTodoist: boolean
  onReply: (mail: MailSummary) => void
  onOpenSettings: () => void
  /** The back button's label; defaults to the mail's folder. */
  backLabel?: string
}

export function MailScreen({
  mail,
  account,
  onBack,
  onToggleArchive,
  hasTodoist,
  onReply,
  onOpenSettings,
  backLabel
}: MailScreenProps): React.JSX.Element {
  const [detail, setDetail] = useState<MailDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sourceOpen, setSourceOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null)
    setError(null)
    window.api
      .getMail(mail.accountId, mail.uid, mail.folder)
      .then((result) => !cancelled && setDetail(result))
      .catch((e: Error) => !cancelled && setError(cleanError(e)))
    return () => {
      cancelled = true
    }
  }, [mail.accountId, mail.uid, mail.folder])

  const sender = detail?.from[0]
  const inArchive = mail.folder === 'archive'
  const sent = mail.folder === 'sent'

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline/[.06] bg-background/70">
      {/* Floating glass toolbar; the mail scrolls underneath it. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
        <div className="sheen pointer-events-auto flex items-center gap-1 rounded-full border border-hairline/10 bg-glass/60 p-1 backdrop-blur-2xl backdrop-saturate-150">
          <Button variant="ghost" className="px-3" onClick={onBack}>
            <ChevronLeft />
            {backLabel ?? (inArchive ? 'Archive' : sent ? 'Sent' : 'Inbox')} <Kbd>Esc</Kbd>
          </Button>
          <span className="mx-1 h-5 w-px bg-hairline/10" />
          {!sent && (
            <Button variant="ghost" onClick={() => onReply(mail)}>
              <Reply />
              Reply <Kbd>R</Kbd>
            </Button>
          )}
          {sent ? null : inArchive ? (
            <Button variant="ghost" onClick={() => onToggleArchive(mail)}>
              <Inbox />
              Move to inbox <Kbd>E</Kbd>
            </Button>
          ) : (
            <Button onClick={() => onToggleArchive(mail)}>
              <Archive />
              Archive
              <Kbd className="border-primary-foreground/25 bg-transparent text-primary-foreground/80">
                E
              </Kbd>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="View source"
            aria-label="View source"
            onClick={() => setSourceOpen(true)}
          >
            <FileCode />
          </Button>
        </div>
      </div>
      <SourceDialog key={mail.key} mail={mail} open={sourceOpen} onOpenChange={setSourceOpen} />

      <div className="min-h-0 flex-1 overflow-auto">
        <article className="mx-auto grid max-w-[760px] animate-in gap-6 px-10 pt-[88px] pb-12 fade-in">
          {(inArchive || sent) && account && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline/10 bg-hairline/[.04] px-3 py-1 text-xs text-muted-foreground">
              {sent ? (
                <>
                  <Send className="size-3.5" /> Sent · {account.name} › Sent
                </>
              ) : (
                <>
                  <Archive className="size-3.5" /> Archived · {account.name} › Archive
                </>
              )}
            </div>
          )}
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-balance">
            {mail.subject}
          </h1>
          <div className="flex items-center gap-3">
            <Avatar
              name={mail.fromName}
              address={sender?.address || mail.fromAddress}
              colorIndex={account?.colorIndex}
              accountName={account?.name}
              size={46}
            />
            <div className="grid min-w-0 gap-0.5">
              <div className="font-semibold">
                {sender?.name || mail.fromName}{' '}
                <span className="font-normal text-muted-foreground">
                  &lt;{sender?.address || mail.fromAddress}&gt;
                </span>
              </div>
              {account && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={cn('size-2 rounded-full', accountDot(account.colorIndex))} />
                  to{' '}
                  {sent
                    ? detail?.to.map((a) => a.name || a.address).join(', ') || mail.toName
                    : account.email}{' '}
                  · {account.name}
                </div>
              )}
            </div>
            <div className="ml-auto text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {longDate(mail.date)}
            </div>
          </div>

          {mail.analysis && (
            <AnalysisCard
              key={mail.analysis.key}
              analysis={mail.analysis}
              hasTodoist={hasTodoist}
              onOpenSettings={onOpenSettings}
            />
          )}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : detail ? (
            <MailBody html={detail.html} text={detail.text} />
          ) : (
            <div className="grid gap-3" aria-label="Loading">
              {[80, 95, 60].map((width) => (
                <div
                  key={width}
                  className="h-4 animate-pulse rounded-full bg-hairline/[.06]"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          )}
        </article>
      </div>
    </main>
  )
}
