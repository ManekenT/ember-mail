import { AlertCircle, Check, Download, LoaderCircle, RefreshCw, Rocket } from 'lucide-react'

import { cn } from '@renderer/lib/utils'
import type { UpdateState } from '../../../shared/types'

/**
 * One button that changes with the update: "Check for updates" → "Checking…" →
 * a download progress fill → "Install x.y.z and restart". The app also checks on its own every few
 * hours and downloads in the background; then this button just shows where it is.
 */
export function UpdateButton({ state }: { state: UpdateState }): React.JSX.Element {
  const { phase, canInstall } = state

  let icon = <RefreshCw />
  let label: React.ReactNode = 'Check for updates'
  let status = ''
  let action: (() => void) | undefined = () => void window.api.checkForUpdates()
  let tone: 'quiet' | 'busy' | 'ready' | 'error' = 'quiet'

  switch (phase.status) {
    case 'checking':
      icon = <LoaderCircle className="animate-spin" />
      label = 'Checking…'
      action = undefined
      tone = 'busy'
      break
    case 'up-to-date':
      icon = <Check className="text-live" />
      label = 'Up to date'
      break
    case 'downloading':
      icon = <Download />
      label = (
        <>
          Downloading {phase.version}{' '}
          <span className="text-muted-foreground tabular-nums">{phase.percent}%</span>
        </>
      )
      action = undefined
      tone = 'busy'
      break
    case 'ready':
      icon = <Rocket />
      label = canInstall ? `Install ${phase.version} and restart` : `${phase.version} downloaded`
      status = canInstall ? '' : 'Installs only in the installed app'
      action = canInstall ? () => void window.api.installUpdate() : undefined
      tone = 'ready'
      break
    case 'error':
      icon = <AlertCircle />
      label = 'Retry update check'
      status = phase.message
      tone = 'error'
      break
  }

  const percent = phase.status === 'downloading' ? phase.percent : 0

  return (
    <div>
      <button
        type="button"
        disabled={!action}
        onClick={action}
        aria-live="polite"
        className={cn(
          'relative flex h-9 w-full items-center justify-center gap-2 overflow-hidden rounded-full border text-[13px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[.98] [&_svg]:size-[15px] [&_svg]:shrink-0',
          tone === 'quiet' &&
            'border-hairline/10 bg-hairline/[.04] text-muted-foreground hover:bg-hairline/[.08] hover:text-foreground',
          tone === 'busy' && 'cursor-default border-primary/30 bg-primary/10 text-foreground',
          tone === 'ready' &&
            'border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/.25),0_6px_18px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-primary/90 disabled:cursor-default disabled:opacity-70',
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
        <span className="relative flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
      </button>
      {status && (
        <p
          className={cn(
            'mt-1.5 truncate px-1 text-center text-[11px]',
            phase.status === 'error' ? 'text-destructive' : 'text-muted-foreground/80'
          )}
          title={status}
        >
          {status}
        </p>
      )}
    </div>
  )
}
