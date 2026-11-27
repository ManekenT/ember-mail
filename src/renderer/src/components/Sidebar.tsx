import { Archive, Inbox, Plus, Trash2 } from 'lucide-react'

import { UpdateButton } from '@renderer/components/UpdateButton'
import { useUpdates } from '@renderer/hooks/useUpdates'

import { Button } from '@renderer/components/ui/button'
import { accountDot } from '@renderer/lib/format'
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
  onRemoveAccount
}: SidebarProps): React.JSX.Element {
  const updates = useUpdates()
  const unread = (accountId: string): number =>
    inbox.filter((m) => m.unread && (accountId === 'all' || m.accountId === accountId)).length

  return (
    <aside className="sheen flex min-h-0 w-[244px] shrink-0 flex-col gap-5 overflow-auto rounded-2xl border border-hairline/[.07] bg-glass/45 px-3 py-3 backdrop-blur-2xl backdrop-saturate-150">
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
                  style={{ boxShadow: `0 0 8px var(--account-${(account.colorIndex % 3) + 1})` }}
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
              <button
                type="button"
                title={`Remove ${account.name}`}
                aria-label={`Remove ${account.name}`}
                onClick={() => onRemoveAccount(account)}
                className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded-full p-1.5 text-muted-foreground group-hover:block hover:bg-hairline/[.08] hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )
        })}
        <NavItem onClick={onAddAccount}>
          <Plus className="size-4" />
          Add account
        </NavItem>
      </nav>

      <div className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-3">
        {updates && <UpdateButton state={updates} />}
        <div className="flex items-center gap-2 border-t border-hairline/[.07] pt-3">
          <StatusLine accounts={accounts} statuses={statuses} />
          {updates && (
            <span className="ml-auto shrink-0 rounded-full border border-hairline/10 bg-hairline/[.04] px-2 py-px text-[11px] text-muted-foreground tabular-nums">
              v{updates.currentVersion}
            </span>
          )}
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

function StatusLine({
  accounts,
  statuses
}: {
  accounts: AccountInfo[]
  statuses: Record<string, AccountStatus>
}): React.JSX.Element {
  const live = accounts.filter((a) => statuses[a.id]?.state === 'live').length
  const failing = accounts.filter((a) => statuses[a.id]?.state === 'error').length
  const total = accounts.length

  let dot = 'bg-muted-foreground'
  let text = 'No accounts yet'
  if (total > 0 && live === total) {
    dot = 'bg-live shadow-[0_0_0_3px_color-mix(in_oklab,var(--live)_20%,transparent)]'
    text = `Live · ${total} ${total === 1 ? 'account' : 'accounts'}`
  } else if (failing > 0) {
    dot = 'bg-destructive'
    text = `${failing} of ${total} ${total === 1 ? 'account' : 'accounts'} not connected`
  } else if (total > 0) {
    dot = 'bg-primary animate-pulse'
    text = 'Connecting…'
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-1 text-xs text-muted-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', dot)} />
      <span className="truncate">{text}</span>
    </div>
  )
}
