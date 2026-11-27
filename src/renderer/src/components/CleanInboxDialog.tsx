import { Archive, ListTodo, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { CleanupSuggestion } from '@renderer/lib/cleanup'
import { accountDot } from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'
import type { AccountInfo } from '../../../shared/types'

export interface CleanupResult {
  archived: Array<{ accountId: string; archivedUid: number | null; key: string }>
  tasks: number
  failed: number
}

interface CleanInboxDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions: CleanupSuggestion[]
  accounts: AccountInfo[]
  hasTodoist: boolean
  onOpenSettings: () => void
  /** Called for each mail right before it is archived, to hide it at once. */
  onArchiving: (key: string) => void
  onDone: (result: CleanupResult) => void
}

/** Claude's cleanup suggestions, to review and uncheck before anything happens. */
export function CleanInboxDialog(props: CleanInboxDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[640px]">
        {/* Keyed so the selection starts fresh with every opening. */}
        {props.open && <CleanInboxBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function CleanInboxBody({
  onOpenChange,
  suggestions,
  accounts,
  hasTodoist,
  onOpenSettings,
  onArchiving,
  onDone
}: CleanInboxDialogProps): React.JSX.Element {
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const [selected, setSelected] = useState(
    () =>
      new Set(
        suggestions.filter((s) => hasTodoist || s.action === 'archive').map((s) => s.mail.key)
      )
  )
  const [progress, setProgress] = useState<number | null>(null)

  const chosen = suggestions.filter((s) => selected.has(s.mail.key))
  const groups = [
    { action: 'todoist' as const, title: 'Add to Todoist, then archive', icon: ListTodo },
    { action: 'archive' as const, title: 'Archive', icon: Archive }
  ]

  const toggle = (key: string): void =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const run = async (): Promise<void> => {
    const result: CleanupResult = { archived: [], tasks: 0, failed: 0 }
    setProgress(0)
    for (const [i, suggestion] of chosen.entries()) {
      const { mail } = suggestion
      try {
        for (const index of suggestion.dateIndexes) {
          await window.api.addToTodoist(mail.analysis!.key, index)
          result.tasks++
        }
        onArchiving(mail.key)
        const archivedUid = await window.api.archiveMail(mail.accountId, mail.uid)
        result.archived.push({ accountId: mail.accountId, archivedUid, key: mail.key })
      } catch {
        result.failed++
      }
      setProgress(i + 1)
    }
    onDone(result)
    onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Clean inbox</DialogTitle>
      </DialogHeader>

      {suggestions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing to clean up.</p>
      ) : (
        <div className="-mx-2 grid min-h-0 flex-1 gap-5 overflow-auto px-2">
          {groups.map(({ action, title, icon: Icon }) => {
            const items = suggestions.filter((s) => s.action === action)
            if (items.length === 0) return null
            const blocked = action === 'todoist' && !hasTodoist
            return (
              <section key={action} className="grid gap-1">
                <h3 className="flex items-center gap-2 px-1 pb-1 text-[11px] font-medium tracking-[.08em] text-muted-foreground/80 uppercase">
                  <Icon className="size-3.5" /> {title}
                </h3>
                {blocked && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="w-fit px-1 pb-1 text-left text-xs text-primary hover:underline"
                  >
                    Add your Todoist token in Settings
                  </button>
                )}
                {items.map((s) => {
                  const account = accountById.get(s.mail.accountId)
                  return (
                    <label
                      key={s.mail.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-hairline/[.05]',
                        blocked && 'pointer-events-none opacity-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        checked={selected.has(s.mail.key)}
                        disabled={blocked || progress !== null}
                        onChange={() => toggle(s.mail.key)}
                      />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          {account && (
                            <span
                              className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                accountDot(account.colorIndex)
                              )}
                            />
                          )}
                          <span className="shrink-0 font-medium">{s.mail.fromName}</span>
                          <span className="truncate text-muted-foreground">{s.mail.subject}</span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{s.reason}</span>
                      </span>
                    </label>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" disabled={progress !== null} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        {suggestions.length > 0 && (
          <Button disabled={chosen.length === 0 || progress !== null} onClick={() => void run()}>
            {progress !== null && <LoaderCircle className="animate-spin" />}
            {progress !== null
              ? `Cleaning up ${progress} of ${chosen.length}`
              : `Clean up ${chosen.length}`}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
