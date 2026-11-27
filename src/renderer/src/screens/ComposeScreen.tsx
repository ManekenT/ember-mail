import { ChevronDown, LoaderCircle, Send, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Kbd } from '@renderer/components/Kbd'
import { Button } from '@renderer/components/ui/button'
import { cleanError } from '@renderer/lib/errors'
import { accountDot, longDate } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, MailDetail, MailSummary } from '../../../shared/types'

interface ComposeScreenProps {
  accounts: AccountInfo[]
  /** The account to send from for a new mail (the one in view). */
  defaultAccountId: string | null
  /** Set when replying. */
  replyTo: MailSummary | null
  hasClaude: boolean
  onClose: () => void
  onSent: (text: string) => void
  /** Opens the account dialog, to set up sending. */
  onEditAccount: (account: AccountInfo) => void
}

const domainOf = (address: string): string => address.split('@')[1]?.toLowerCase() ?? ''

/**
 * For a reply, the address the mail was sent to, when it belongs to the account:
 * a known alias, or any address on the account's own domain (catch-all).
 */
function replyFromAddress(account: AccountInfo, original: MailDetail): string {
  const own = [account.email, ...account.addresses].map((a) => a.toLowerCase())
  const recipients = [...original.to, ...original.cc].map((a) => a.address)
  return (
    recipients.find((a) => own.includes(a.toLowerCase())) ??
    recipients.find((a) => domainOf(a) === domainOf(account.email)) ??
    account.email
  )
}

function replySubject(subject: string): string {
  return /^(re|aw|antw):/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

/** Writing a new mail or a reply, full-size like the mail view. */
export function ComposeScreen({
  accounts,
  defaultAccountId,
  replyTo,
  hasClaude,
  onClose,
  onSent,
  onEditAccount
}: ComposeScreenProps): React.JSX.Element {
  const [accountId, setAccountId] = useState(
    replyTo?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? ''
  )
  const account = accounts.find((a) => a.id === accountId)
  const [from, setFrom] = useState(account?.email ?? '')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(replyTo ? replySubject(replyTo.subject) : '')
  const [body, setBody] = useState('')
  const [original, setOriginal] = useState<MailDetail | null>(null)
  const [showQuote, setShowQuote] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // A reply starts from the mail it answers: recipient, sender address, quote.
  useEffect(() => {
    if (!replyTo) return
    let cancelled = false
    window.api
      .getMail(replyTo.accountId, replyTo.uid, replyTo.folder)
      .then((detail) => {
        if (cancelled) return
        setOriginal(detail)
        const target = detail.replyTo[0] ?? detail.from[0]
        if (target) setTo(target.name ? `${target.name} <${target.address}>` : target.address)
        const replyAccount = accounts.find((a) => a.id === replyTo.accountId)
        if (replyAccount) setFrom(replyFromAddress(replyAccount, detail))
        bodyRef.current?.focus()
      })
      .catch((e: Error) => !cancelled && setError(cleanError(e)))
    return () => {
      cancelled = true
    }
  }, [replyTo, accounts])

  const changeAccount = (id: string): void => {
    setAccountId(id)
    setFrom(accounts.find((a) => a.id === id)?.email ?? '')
  }

  const send = useCallback(async () => {
    if (!account || sending) return
    setSending(true)
    setError(null)
    try {
      await window.api.sendMail({
        accountId: account.id,
        from: from.trim() || account.email,
        to,
        cc: showCc ? cc : '',
        subject,
        text: body,
        replyTo: replyTo ? { uid: replyTo.uid, folder: replyTo.folder } : undefined
      })
      onSent(`Sent from ${from.trim() || account.email}`)
    } catch (e) {
      setError(cleanError(e as Error))
      setSending(false)
    }
  }, [account, sending, from, to, cc, showCc, subject, body, replyTo, onSent])

  const discard = useCallback(() => {
    if (body.trim() && !window.confirm('Discard this mail?')) return
    onClose()
  }, [body, onClose])

  // Ctrl+Enter sends, Esc discards.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void send()
      } else if (
        event.key === 'Escape' &&
        !(event.target as HTMLElement).closest('[role="dialog"]')
      ) {
        event.preventDefault()
        discard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send, discard])

  const addresses = useMemo(() => (account ? [account.email, ...account.addresses] : []), [account])

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline/[.06] bg-background/70">
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
        <div className="sheen pointer-events-auto flex items-center gap-1 rounded-full border border-hairline/10 bg-glass/60 p-1 backdrop-blur-2xl backdrop-saturate-150">
          <Button variant="ghost" className="px-3" onClick={discard} disabled={sending}>
            <X />
            Discard <Kbd>Esc</Kbd>
          </Button>
          <span className="mx-1 h-5 w-px bg-hairline/10" />
          <Button onClick={() => void send()} disabled={sending || !account?.smtpHost}>
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
            Send
            <Kbd className="border-primary-foreground/25 bg-transparent text-primary-foreground/80">
              Ctrl ↵
            </Kbd>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[760px] animate-in gap-1 px-10 pt-[88px] pb-12 fade-in">
          <h1 className="pb-4 text-[30px] leading-tight font-semibold tracking-tight">
            {replyTo ? 'Reply' : 'New mail'}
          </h1>

          <Row label="From">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  account && accountDot(account.colorIndex)
                )}
              />
              <select
                aria-label="Account"
                value={accountId}
                onChange={(e) => changeAccount(e.target.value)}
                className="max-w-44 shrink-0 truncate rounded-lg bg-transparent py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Sender address"
                list="sender-addresses"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
              />
              <datalist id="sender-addresses">
                {addresses.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </Row>
          {account && !account.smtpHost && (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
              Sending isn&apos;t set up for {account.name}.
              <Button size="xs" variant="outline" onClick={() => onEditAccount(account)}>
                Set up
              </Button>
            </p>
          )}
          <Row label="To">
            <input
              aria-label="To"
              autoFocus={!replyTo}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
            />
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Cc
              </button>
            )}
          </Row>
          {showCc && (
            <Row label="Cc">
              <input
                aria-label="Cc"
                autoFocus
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
              />
            </Row>
          )}
          <Row label="Subject">
            <input
              aria-label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium outline-none"
            />
          </Row>

          {replyTo && hasClaude && (
            <DraftBar
              replyTo={replyTo}
              from={from.trim() || account?.email || ''}
              onText={setBody}
              onError={setError}
            />
          )}

          <textarea
            ref={bodyRef}
            aria-label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-4 min-h-[280px] w-full resize-none rounded-xl border border-hairline/[.07] bg-hairline/[.02] p-4 text-[15px] leading-relaxed outline-none [field-sizing:content] focus-visible:border-hairline/15"
          />

          {error && (
            <p role="alert" className="pt-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {original && (
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setShowQuote((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown
                  className={cn('size-3.5 transition-transform', showQuote && 'rotate-180')}
                />
                {original.from[0]?.name || original.from[0]?.address}, {longDate(original.date)}
              </button>
              {showQuote && (
                <pre className="mt-2 border-l-2 border-hairline/10 pl-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {original.text.trim()}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-hairline/[.07] py-2">
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/** Suggestion chips and a prompt; Claude writes the reply into the message field. */
function DraftBar({
  replyTo,
  from,
  onText,
  onError
}: {
  replyTo: MailSummary
  from: string
  onText: (text: string) => void
  onError: (message: string | null) => void
}): React.JSX.Element {
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [instruction, setInstruction] = useState('')
  const [drafting, setDrafting] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api
      .replySuggestions(replyTo.accountId, replyTo.uid, replyTo.folder)
      .then((list) => !cancelled && setSuggestions(list))
      .catch(() => !cancelled && setSuggestions([]))
    return () => {
      cancelled = true
    }
  }, [replyTo])

  const draft = async (text: string): Promise<void> => {
    if (drafting) return
    setDrafting(true)
    onError(null)
    const requestId = crypto.randomUUID()
    const stop = window.api.onDraftText((id, partial) => id === requestId && onText(partial))
    try {
      onText(
        await window.api.draftReply({
          requestId,
          accountId: replyTo.accountId,
          uid: replyTo.uid,
          folder: replyTo.folder,
          instruction: text,
          from
        })
      )
    } catch (e) {
      onError(cleanError(e as Error))
    } finally {
      stop()
      setDrafting(false)
    }
  }

  return (
    <div className="mt-4 grid gap-2.5 rounded-2xl border border-hairline/[.08] bg-glass/40 p-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-1.5">
        {suggestions === null
          ? [96, 120, 84].map((width) => (
              <span
                key={width}
                className="h-7 animate-pulse rounded-full bg-hairline/[.06]"
                style={{ width }}
              />
            ))
          : suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={drafting}
                onClick={() => {
                  setInstruction(s)
                  void draft(s)
                }}
                className="h-7 rounded-full border border-hairline/10 bg-hairline/[.04] px-3 text-xs hover:bg-hairline/[.08] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void draft(instruction)
        }}
      >
        <Sparkles className="ml-1 size-4 shrink-0 text-primary" />
        <input
          aria-label="What should the reply say?"
          placeholder="What should the reply say?"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
        />
        <Button type="submit" size="sm" disabled={drafting}>
          {drafting && <LoaderCircle className="animate-spin" />}
          Write
        </Button>
      </form>
    </div>
  )
}
