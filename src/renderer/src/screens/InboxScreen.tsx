import { Inbox, Plus } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'
import type { MailSummary } from '@renderer/demo-data'
import { cn } from '@renderer/lib/utils'

interface InboxScreenProps {
  mails: MailSummary[]
  onOpen: (id: string) => void
}

export function InboxScreen({ mails, onOpen }: InboxScreenProps): React.JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="flex w-[232px] shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-3 text-base font-semibold">
          <span
            aria-hidden="true"
            className="size-3.5 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffd27a,var(--primary))] shadow-[0_0_12px_var(--primary)]"
          />
          Ember Mail
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <Button variant="secondary" className="justify-start">
            <Inbox />
            All inboxes
          </Button>
        </nav>
        <Button variant="ghost" className="justify-start text-muted-foreground" disabled>
          <Plus />
          Add account
        </Button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-baseline justify-between px-10 pt-7 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <span className="text-sm text-muted-foreground">{mails.length} mails</span>
        </header>

        {mails.length === 0 ? (
          <div className="m-auto text-muted-foreground">Inbox Zero. Nice.</div>
        ) : (
          <ul className="flex-1 overflow-y-auto px-6 pb-6">
            {mails.map((mail) => (
              <li key={mail.id}>
                <button
                  onClick={() => onOpen(mail.id)}
                  className="group flex w-full items-start gap-4 rounded-lg px-4 py-4 text-left transition-colors hover:bg-accent"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-2 size-2 shrink-0 rounded-full',
                      mail.unread ? 'bg-primary' : 'bg-transparent'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className={cn('truncate text-[15px]', mail.unread && 'font-semibold')}>
                        {mail.from}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{mail.date}</span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[15px]',
                        mail.unread && 'font-medium'
                      )}
                    >
                      {mail.subject}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {mail.preview}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
