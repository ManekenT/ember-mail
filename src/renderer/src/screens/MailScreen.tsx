import { Archive, ChevronLeft, Inbox } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Avatar } from '@renderer/components/Avatar'
import { Kbd } from '@renderer/components/Kbd'
import { MailBody } from '@renderer/components/MailBody'
import { Button } from '@renderer/components/ui/button'
import { cleanError } from '@renderer/lib/errors'
import { accountDot, longDate } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailDetail, MailSummary } from '../../../shared/types'

interface MailScreenProps {
  mail: MailSummary
  account: AccountInfo | undefined
  position: { index: number; total: number }
  onBack: () => void
  /** Archives an inbox mail, or moves an archived mail back to the inbox. */
  onToggleArchive: (mail: MailSummary) => void
}

export function MailScreen({
  mail,
  account,
  position,
  onBack,
  onToggleArchive
}: MailScreenProps): React.JSX.Element {
  const [detail, setDetail] = useState<MailDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button variant="ghost" className="px-3" onClick={onBack}>
          <ChevronLeft />
          {inArchive ? 'Archive' : 'Inbox'} <Kbd>Esc</Kbd>
        </Button>
        <div className="mx-2 h-5 w-px bg-border" />
        <Button onClick={() => onToggleArchive(mail)}>
          {inArchive ? <Inbox /> : <Archive />}
          {inArchive ? 'Move to inbox' : 'Archive'}
          <Kbd className="border-primary-foreground/30 bg-transparent text-primary-foreground">
            E
          </Kbd>
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {position.index + 1} of {position.total}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <article className="mx-auto grid max-w-[760px] animate-in gap-6 px-10 pt-9 pb-10 fade-in">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">
            {mail.subject}
          </h1>
          <div className="flex items-start gap-3">
            <Avatar name={mail.fromName} address={sender?.address || mail.fromAddress} />
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
                  to {account.email} · {account.name}
                </div>
              )}
            </div>
            <div className="ml-auto text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {longDate(mail.date)}
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : detail ? (
            <MailBody html={detail.html} text={detail.text} />
          ) : (
            <div className="grid gap-3" aria-label="Loading">
              {[80, 95, 60].map((width) => (
                <div
                  key={width}
                  className="h-4 animate-pulse rounded bg-muted"
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
