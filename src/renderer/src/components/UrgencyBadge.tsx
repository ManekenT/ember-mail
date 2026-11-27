import { cn } from '@renderer/lib/utils'
import type { MailAnalysis } from '../../../shared/types'

/** "Urgent" or "Important" from Claude's analysis; nothing for ordinary mail. */
export function UrgencyBadge({
  analysis,
  className
}: {
  analysis: MailAnalysis | undefined
  className?: string
}): React.JSX.Element | null {
  if (!analysis || analysis.urgency === 'none') return null
  const urgent = analysis.urgency === 'urgent'
  return (
    <span
      title={analysis.urgencyReason ?? undefined}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-px text-[11px] font-semibold tracking-wide',
        urgent
          ? 'bg-primary text-primary-foreground shadow-[0_0_12px_-2px_var(--primary)]'
          : 'border border-primary/40 text-primary',
        className
      )}
    >
      {urgent ? 'Urgent' : 'Important'}
    </span>
  )
}
