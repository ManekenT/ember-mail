import { CalendarDays, Check, LoaderCircle, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { UrgencyBadge } from '@renderer/components/UrgencyBadge'
import { Button } from '@renderer/components/ui/button'
import { cleanError } from '@renderer/lib/errors'
import { localDay, mailDateLabel } from '@renderer/lib/format'
import type { MailAnalysis, MailDate } from '../../../shared/types'

const KIND_LABEL: Record<MailDate['kind'], string> = {
  event: 'Event',
  deadline: 'Deadline',
  expiry: 'Expires'
}

interface AnalysisCardProps {
  analysis: MailAnalysis
  hasTodoist: boolean
  onOpenSettings: () => void
}

/** Claude's summary of the open mail, with its dates and Add to Todoist. */
export function AnalysisCard({
  analysis: initial,
  hasTodoist,
  onOpenSettings
}: AnalysisCardProps): React.JSX.Element {
  const [analysis, setAnalysis] = useState(initial)
  const [adding, setAdding] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = localDay()

  const add = async (index: number): Promise<void> => {
    setAdding(index)
    setError(null)
    try {
      setAnalysis(await window.api.addToTodoist(analysis.key, index))
    } catch (e) {
      setError(cleanError(e as Error))
    } finally {
      setAdding(null)
    }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-hairline/[.08] bg-glass/40 px-5 py-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="grid min-w-0 gap-1.5">
          <p className="text-[15px] leading-snug">{analysis.summary}</p>
          {analysis.urgency !== 'none' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UrgencyBadge analysis={analysis} />
              {analysis.urgencyReason}
            </div>
          )}
        </div>
      </div>

      {analysis.dates.map((date, index) => {
        const past = date.date < today
        return (
          <div
            key={`${date.date}-${date.title}`}
            className="ml-7 flex items-center gap-3 rounded-xl border border-hairline/[.07] bg-hairline/[.03] py-1.5 pr-1.5 pl-3"
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{date.title}</span>
              <span className="text-xs text-muted-foreground">
                {KIND_LABEL[date.kind]} · {mailDateLabel(date.date, date.time)}
              </span>
            </div>
            {date.todoistTaskId ? (
              <span className="flex items-center gap-1.5 px-3 text-sm text-muted-foreground">
                <Check className="size-4 text-live" /> In Todoist
              </span>
            ) : past ? null : (
              <Button
                variant="outline"
                size="sm"
                disabled={adding !== null}
                onClick={() => (hasTodoist ? void add(index) : onOpenSettings())}
              >
                {adding === index ? <LoaderCircle className="animate-spin" /> : <Plus />}
                Add to Todoist
              </Button>
            )}
          </div>
        )
      })}
      {error && (
        <p role="alert" className="ml-7 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
