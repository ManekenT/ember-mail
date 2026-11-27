import { AlertCircle, Check, Download, LoaderCircle, RefreshCw, Rocket } from 'lucide-react'

import { useUpdates } from '@renderer/hooks/useUpdates'
import { cn } from '@renderer/lib/utils'

/**
 * One button that changes with the update: "Check for updates" → "Checking…" →
 * a download progress bar → "Install now". The app also checks on its own every few
 * hours and downloads in the background; then this button just shows where it is.
 */
export function UpdateButton(): React.JSX.Element | null {
  const state = useUpdates()
  if (!state) return null
  const { phase, currentVersion, canInstall } = state

  let icon = <RefreshCw />
  let label = 'Check for updates'
  let hint = `Ember Mail ${currentVersion}`
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
      icon = <Check />
      label = 'Up to date'
      hint = `${currentVersion} is the newest version`
      break
    case 'downloading':
      icon = <Download />
      label = `Downloading ${phase.percent}%`
      hint = phase.version ? `Version ${phase.version}` : hint
      action = undefined
      tone = 'busy'
      break
    case 'ready':
      icon = <Rocket />
      label = 'Install now'
      hint = canInstall
        ? `Restarts into ${phase.version}`
        : `${phase.version} downloaded · installs only in the installed app`
      action = canInstall ? () => void window.api.installUpdate() : undefined
      tone = 'ready'
      break
    case 'error':
      icon = <AlertCircle />
      label = `${phase.message} · Retry`
      tone = 'error'
      break
  }

  const percent = phase.status === 'downloading' ? phase.percent : 0

  return (
    <button
      type="button"
      title={hint}
      disabled={!action}
      onClick={action}
      aria-live="polite"
      className={cn(
        'group relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-sm transition-[background-color,color,box-shadow] duration-300 [&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'quiet' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        tone === 'busy' && 'cursor-default bg-accent text-foreground',
        tone === 'ready' &&
          'bg-primary font-medium text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_22%,transparent)] hover:bg-primary/90 disabled:cursor-default disabled:opacity-70',
        tone === 'error' && 'text-destructive hover:bg-accent'
      )}
    >
      {phase.status === 'downloading' && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-primary/25 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      )}
      <span className="relative flex min-w-0 flex-1 items-center gap-2.5">
        {icon}
        <span className="truncate">{label}</span>
        {tone === 'quiet' && phase.status === 'idle' && (
          <span className="ml-auto text-xs text-muted-foreground/70 tabular-nums">
            {currentVersion}
          </span>
        )}
      </span>
    </button>
  )
}
