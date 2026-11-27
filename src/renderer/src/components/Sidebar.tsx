import { Archive, Inbox, PenLine, Pencil, Plus, Settings, Sparkles, Trash2 } from 'lucide-react'

import { UpdateButton } from '@renderer/components/UpdateButton'
import { useUpdates } from '@renderer/hooks/useUpdates'

import { Button } from '@renderer/components/ui/button'
import { accountColor, accountDot } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo, AccountStatus, MailFolder, MailSummary } from '../../../shared/types'

interface SidebarProps {
  accounts: AccountInfo[]
  statuses: Record<string, AccountStatus>
  inbox: MailSummary[]
  folder: MailFolder
  selected: string
  onSelectFolder: (folder: MailFolder) => void
  onSelect: (accountId: string) => void
  onAddAccount: () => void
  onRemoveAccount: (account: AccountInfo) => void
  onEditAccount: (account: AccountInfo) => void
  onCompose: () => void
  /** Why Claude's analysis is paused, if it is. */
  claudeError: string | null
  onOpenSettings: () => void
}

export function Sidebar({
  accounts,
  statuses,
  inbox,
  folder,
  selected,
  onSelectFolder,
  onSelect,
  onAddAccount,
  onRemoveAccount,
  onEditAccount,
  onCompose,
  claudeError,
  onOpenSettings
}: SidebarProps): React.JSX.Element {
  const updates = useUpdates()
  const unread = (accountId: string): number =>
    inbox.filter((m) => m.unread && (accountId === 'all' || m.accountId === accountId)).length

  return (
    <aside className="sheen flex min-h-0 w-[244px] shrink-0 flex-col gap-5 overflow-auto rounded-2xl border border-hairline/[.07] bg-glass/45 px-3 py-3 backdrop-blur-2xl backdrop-saturate-150">
      <Button
        onClick={onCompose}
        className="w-full justify-start gap-3 px-3.5"
        disabled={accounts.length === 0}
      >
        <PenLine />
        New mail
        <span className="ml-auto font-mono text-[10.5px] text-primary-foreground/70">C</span>
      </Button>

      <nav className="grid gap-0.5">
        <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-[.08em] text-muted-foreground/80 uppercase">
          Mailboxes
        </div>
        <NavItem
          active={folder === 'inbox' && selected === 'all'}
          onClick={() => onSelectFolder('inbox')}
        >
          <Inbox className="size-4" />
          All inboxes
          <Count value={unread('all')} />
        </NavItem>
        <NavItem
          active={folder === 'archive' && selected === 'all'}
          onClick={() => onSelectFolder('archive')}
        >
          <Archive className="size-4" />
          Archive
        </NavItem>
      </nav>

      <nav className="grid gap-0.5">
        <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-[.08em] text-muted-foreground/80 uppercase">
          Accounts
        </div>
        {accounts.map((account) => {
          const status = statuses[account.id]
          return (
            <div key={account.id} className="group relative">
              <NavItem
                active={selected === account.id}
                onClick={() => onSelect(account.id)}
                className="h-auto py-2"
              >
                <span
                  className={cn(
                    'mx-1 size-2 shrink-0 rounded-full',
                    accountDot(account.colorIndex)
                  )}
                  style={{ boxShadow: `0 0 8px ${accountColor(account.colorIndex)}` }}
                />
                <span className="grid min-w-0 flex-1 text-left">
                  <span className="truncate">{account.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {status?.state === 'error' ? (
                      <span className="text-destructive">{status.message}</span>
                    ) : (
                      account.email
                    )}
                  </span>
                </span>
                <Count value={unread(account.id)} />
              </NavItem>
              <div className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 gap-0.5 rounded-full bg-glass/90 group-hover:flex">
                <button
                  type="button"
                  title={`Edit ${account.name}`}
                  aria-label={`Edit ${account.name}`}
                  onClick={() => onEditAccount(account)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-hairline/[.08] hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  title={`Remove ${account.name}`}
                  aria-label={`Remove ${account.name}`}
                  onClick={() => onRemoveAccount(account)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-hairline/[.08] hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
        <NavItem onClick={onAddAccount}>
          <Plus className="size-4" />
          Add account
        </NavItem>
      </nav>

      <div className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-3">
        {claudeError && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive"
          >
            <Sparkles className="mt-px size-3.5 shrink-0" />
            {claudeError}
          </button>
        )}
        <div className="flex items-center gap-2 border-t border-hairline/[.07] px-1 pt-3">
          {updates && <UpdateButton state={updates} />}
          <button
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={onOpenSettings}
            className="ml-auto shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-hairline/[.08] hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavItem({
  active,
  className,
  children,
  onClick
}: {
  active?: boolean
  className?: string
  children: React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        'h-9 w-full justify-start gap-3 rounded-xl px-2.5 font-normal text-muted-foreground hover:bg-hairline/[.06] hover:text-foreground active:scale-100',
        active &&
          'bg-hairline/[.09] font-medium text-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--hairline)_6%,transparent)]',
        className
      )}
    >
      {children}
    </Button>
  )
}

function Count({ value }: { value: number }): React.JSX.Element | null {
  return value > 0 ? (
    <span className="ml-auto min-w-5 rounded-full bg-hairline/[.08] px-1.5 text-center text-[11px] tabular-nums">
      {value}
    </span>
  ) : null
}
