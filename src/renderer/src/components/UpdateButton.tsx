import { AlertCircle, Check, LoaderCircle, RefreshCw, Rocket } from 'lucide-react'

import { cn } from '@renderer/lib/utils'
import type { UpdateState } from '../../../shared/types'

/**
 * The version pill in the sidebar's bottom bar, which is also the update control.
 * Click it to check for updates; it then shows the check, the download progress, and,
 * once an update is ready, turns into "Update to x.y.z" (install and restart).
 */
export function UpdateButton({
  state,
  compact = false
}: {
  state: UpdateState
  /** Icon only, for the collapsed sidebar; the version moves into the tooltip. */
  compact?: boolean
}): React.JSX.Element {
  const { phase, canInstall, currentVersion } = state

  let icon: React.ReactNode = (
    <RefreshCw
      className={compact ? undefined : 'hidden group-hover:block group-focus-visible:block'}
    />
  )
  let label: React.ReactNode = `v${currentVersion}`
  let title = compact ? `v${currentVersion}. Check for updates` : 'Check for updates'
  let action: (() => void) | undefined = () => void window.api.checkForUpdates()
  let tone: 'quiet' | 'busy' | 'ready' | 'error' = 'quiet'

  switch (phase.status) {
    case 'checking':
      icon = <LoaderCircle className="animate-spin" />
      title = 'Checking for updates'
      action = undefined
      tone = 'busy'
      break
    case 'up-to-date':
      icon = <Check className="text-live" />
      title = compact
        ? `v${currentVersion} is up to date. Click to check again`
        : 'Up to date. Click to check again'
      break
    case 'downloading':
      icon = <LoaderCircle className="animate-spin" />
      label = <span className="tabular-nums">{phase.percent}%</span>
      title = `Downloading ${phase.version}`
      action = undefined
      tone = 'busy'
      break
    case 'ready':
      icon = <Rocket />
      label = canInstall ? `Update to ${phase.version}` : `${phase.version} downloaded`
      title = canInstall
        ? `Install ${phase.version} and restart`
        : 'Updates install only in the installed app'
      action = canInstall ? () => void window.api.installUpdate() : undefined
      tone = 'ready'
      break
    case 'error':
      icon = <AlertCircle />
      title = `${phase.message} Click to try again`
      tone = 'error'
      break
  }

  const percent = phase.status === 'downloading' ? phase.percent : 0

  return (
    <button
      type="button"
      disabled={!action}
      onClick={action}
      title={title}
      aria-label={title}
      aria-live="polite"
      className={cn(
        'group relative flex min-w-0 items-center gap-1.5 overflow-hidden rounded-full border text-[11px] font-medium tabular-nums transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[.97] [&_svg]:size-3 [&_svg]:shrink-0',
        compact ? 'size-8 justify-center [&_svg]:size-3.5' : 'h-6 px-2.5',
        tone === 'quiet' &&
          'border-hairline/10 bg-hairline/[.04] text-muted-foreground hover:bg-hairline/[.08] hover:text-foreground',
        tone === 'busy' && 'cursor-default border-primary/30 bg-primary/10 text-foreground',
        tone === 'ready' &&
          'border-transparent bg-primary text-primary-foreground shadow-[0_0_14px_-3px_var(--primary)] hover:bg-primary/90 disabled:cursor-default disabled:opacity-70',
        tone === 'error' && 'border-destructive/30 text-destructive hover:bg-destructive/10'
      )}
    >
      {phase.status === 'downloading' && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-primary/35 transition-[width] duration-300 ease-linear"
          style={{ width: `${percent}%` }}
        />
      )}
      <span className="relative flex min-w-0 items-center gap-1.5">
        {icon}
        {!compact && <span className="truncate">{label}</span>}
      </span>
    </button>
  )
}
