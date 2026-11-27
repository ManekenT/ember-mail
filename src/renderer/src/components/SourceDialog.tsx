import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { cleanError } from '@renderer/lib/errors'
import type { MailSummary } from '../../../shared/types'

/** Above this, the source is cut for display (big attachments); Copy still copies all of it. */
const SHOWN_CHARS = 400_000

export function SourceDialog({
  mail,
  open,
  onOpenChange
}: {
  mail: MailSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api
      .getMailSource(mail.accountId, mail.uid, mail.folder)
      .then((text) => !cancelled && setSource(text))
      .catch((e: Error) => !cancelled && setError(cleanError(e)))
    return () => {
      cancelled = true
    }
  }, [open, mail.accountId, mail.uid, mail.folder])

  const copy = async (): Promise<void> => {
    if (source === null) return
    await navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[min(1000px,90vw)]">
        <DialogHeader className="flex-row items-center gap-3 pr-8">
          <DialogTitle className="truncate">Source</DialogTitle>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={source === null}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <pre className="min-h-40 flex-1 overflow-auto rounded-xl border border-hairline/[.07] bg-black/30 p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap select-text">
            {source === null
              ? ''
              : source.length > SHOWN_CHARS
                ? `${source.slice(0, SHOWN_CHARS)}\n\n[${Math.round((source.length - SHOWN_CHARS) / 1024)} KB more, use Copy for all of it]`
                : source}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  )
}
