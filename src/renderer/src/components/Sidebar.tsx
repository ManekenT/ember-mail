import {
  Archive,
  Inbox,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2
} from 'lucide-react'

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
  /** Parcels on their way; the Deliveries item shows when there is a count (or Claude is on). */
  deliveryCount: number | null
  deliveriesActive: boolean
  onOpenDeliveries: () => void
  /** Collapsed to a slim icon rail. */
  collapsed: boolean
  onToggleCollapsed: () => void
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
  onOpenSettings,
  deliveryCount,
  deliveriesActive,
  onOpenDeliveries,
  collapsed,
  onToggleCollapsed
}: SidebarProps): React.JSX.Element {
  const updates = useUpdates()
  const unread = (accountId: string): number =>
    inbox.filter((m) => m.unread && (accountId === 'all' || m.accountId === accountId)).length

  return (
    <aside
      className={cn(
        'sheen flex min-h-0 shrink-0 flex-col gap-5 overflow-x-hidden overflow-y-auto rounded-2xl border border-hairline/[.07] bg-glass/45 py-3 backdrop-blur-2xl backdrop-saturate-150 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[60px] items-center px-2' : 'w-[244px] px-3'
      )}
    >
      <Button
        onClick={onCompose}
        title={collapsed ? 'New mail (C)' : undefined}
        aria-label="New mail"
        size={collapsed ? 'icon' : 'default'}
        className={cn(!collapsed && 'w-full justify-start gap-3 px-3.5')}
        disabled={accounts.length === 0}
      >
        <PenLine />
        {!collapsed && (
          <>
            New mail
            <span className="ml-auto font-mono text-[10.5px] text-primary-foreground/70">C</span>
          </>
        )}
      </Button>

      <nav className="grid gap-0.5">
        {!collapsed && <SectionLabel>Mailboxes</SectionLabel>}
        <NavItem
          collapsed={collapsed}
          label="All inboxes"
          icon={<Inbox className="size-4" />}
          count={unread('all')}
          active={!deliveriesActive && folder === 'inbox' && selected === 'all'}
          onClick={() => onSelectFolder('inbox')}
        />
        <NavItem
          collapsed={collapsed}
          label="Archive"
          icon={<Archive className="size-4" />}
          active={!deliveriesActive && folder === 'archive' && selected === 'all'}
          onClick={() => onSelectFolder('archive')}
        />
        {deliveryCount !== null && (
          <NavItem
            collapsed={collapsed}
            label="Deliveries"
            icon={<Package className="size-4" />}
            count={deliveryCount}
            active={deliveriesActive}
            onClick={onOpenDeliveries}
          />
        )}
      </nav>

      <nav className="grid gap-0.5">
        {!collapsed && <SectionLabel>Accounts</SectionLabel>}
        {accounts.map((account) => {
          const status = statuses[account.id]
          const failed = status?.state === 'error'
          const dot = (
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                !collapsed && 'mx-1',
                accountDot(account.colorIndex)
              )}
              style={{ boxShadow: `0 0 8px ${accountColor(account.colorIndex)}` }}
            />
          )
          if (collapsed)
            return (
              <NavItem
                key={account.id}
                collapsed
                label={failed ? `${account.name}: ${status.message}` : account.name}
                icon={
                  <span className="relative grid size-4 place-items-center">
                    {dot}
                    {failed && (
                      <span className="absolute -right-1 -bottom-1 size-1.5 rounded-full bg-destructive" />
                    )}
                  </span>
                }
                count={unread(account.id)}
                active={!deliveriesActive && selected === account.id}
                onClick={() => onSelect(account.id)}
              />
            )
          return (
            <div key={account.id} className="group relative">
              <NavItem
                label={account.name}
                icon={dot}
                count={unread(account.id)}
                active={!deliveriesActive && selected === account.id}
                onClick={() => onSelect(account.id)}
                className="h-auto py-2"
              >
                <span className="grid min-w-0 flex-1 text-left">
                  <span className="truncate">{account.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {failed ? (
                      <span className="text-destructive">{status.message}</span>
                    ) : (
                      account.email
                    )}
                  </span>
                </span>
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
        <NavItem
          collapsed={collapsed}
          label="Add account"
          icon={<Plus className="size-4" />}
          onClick={onAddAccount}
        />
      </nav>

      <div
        className={cn(
          'mt-auto grid gap-3',
          collapsed ? 'justify-items-center' : 'grid-cols-[minmax(0,1fr)]'
        )}
      >
        {claudeError &&
          (collapsed ? (
            <button
              type="button"
              title={claudeError}
              aria-label={claudeError}
              onClick={onOpenSettings}
              className="grid size-8 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive"
            >
              <Sparkles className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive"
            >
              <Sparkles className="mt-px size-3.5 shrink-0" />
              {claudeError}
            </button>
          ))}
        <div
          className={cn(
            'flex items-center gap-2 border-t border-hairline/[.07] pt-3',
            collapsed ? 'flex-col px-0' : 'px-1'
          )}
        >
          {updates && <UpdateButton state={updates} compact={collapsed} />}
          <button
            type="button"
            title="Settings"
            aria-label="Settings"
            onClick={onOpenSettings}
            className={cn(
              'shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-hairline/[.08] hover:text-foreground',
              !collapsed && 'ml-auto'
            )}
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            title={collapsed ? 'Expand sidebar (Ctrl B)' : 'Collapse sidebar (Ctrl B)'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapsed}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-hairline/[.08] hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-[.08em] whitespace-nowrap text-muted-foreground/80 uppercase">
      {children}
    </div>
  )
}

function NavItem({
  active,
  collapsed,
  label,
  icon,
  count = 0,
  className,
  children,
  onClick
}: {
  active?: boolean
  collapsed?: boolean
  label: string
  icon: React.ReactNode
  count?: number
  className?: string
  /** Replaces the label in the expanded sidebar. */
  children?: React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'h-9 rounded-xl font-normal text-muted-foreground hover:bg-hairline/[.06] hover:text-foreground active:scale-100',
        collapsed ? 'relative w-10 px-0' : 'w-full justify-start gap-3 px-2.5',
        active &&
          'bg-hairline/[.09] font-medium text-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--hairline)_6%,transparent)]',
        className
      )}
    >
      {icon}
      {collapsed ? (
        count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[9.5px] leading-4 font-semibold text-primary-foreground tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )
      ) : (
        <>
          {children ?? label}
          <Count value={count} />
        </>
      )}
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
