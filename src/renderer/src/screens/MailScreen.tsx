import { Archive, ArrowLeft } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'
import type { MailSummary } from '@renderer/demo-data'

interface MailScreenProps {
  mail: MailSummary
  onBack: () => void
  onArchive: (id: string) => void
}

export function MailScreen({ mail, onBack, onArchive }: MailScreenProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Inbox
        </Button>
        <Button variant="outline" onClick={() => onArchive(mail.id)}>
          <Archive />
          Archive
        </Button>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-10 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{mail.subject}</h1>
        <div className="mt-3 flex items-baseline justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{mail.from}</span> · {mail.account}
          </span>
          <span>{mail.date}</span>
        </div>
        <div className="mt-8 leading-relaxed whitespace-pre-line">{mail.body}</div>
      </article>
    </div>
  )
}
