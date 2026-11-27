import { Copy, ExternalLink, Package } from 'lucide-react'

import { Avatar } from '@renderer/components/Avatar'
import { Button } from '@renderer/components/ui/button'
import { mailDateLabel } from '@renderer/lib/format'
import { PARCEL_LABEL, PARCEL_STEPS, parcelStep } from '@renderer/lib/parcels'
import { cn } from '@renderer/lib/utils'
import type { Delivery } from '../../../shared/types'

interface DeliveriesScreenProps {
  deliveries: Delivery[]
  onOpenMail: (delivery: Delivery) => void
  onCopied: (text: string) => void
}

/** Orders and parcels found in mail, the ones on their way first. */
export function DeliveriesScreen({
  deliveries,
  onOpenMail,
  onCopied
}: DeliveriesScreenProps): React.JSX.Element {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-hairline/[.06] bg-background/70">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <header className="sticky top-0 z-10 flex min-h-14 items-center border-b border-hairline/[.07] bg-glass/55 px-8 py-3 backdrop-blur-2xl backdrop-saturate-150">
          <h1 className="text-xl font-semibold tracking-tight">Deliveries</h1>
        </header>

        {deliveries.length === 0 ? (
          <div className="grid flex-1 place-content-center justify-items-center gap-3 py-16 text-center">
            <Package className="size-10 text-muted-foreground/60" />
            <p className="text-lg font-semibold tracking-tight">Nothing on its way</p>
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-[808px] gap-3 px-4 pt-5 pb-8">
            {deliveries.map((delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                onOpenMail={() => onOpenMail(delivery)}
                onCopied={onCopied}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function DeliveryCard({
  delivery,
  onOpenMail,
  onCopied
}: {
  delivery: Delivery
  onOpenMail: () => void
  onCopied: (text: string) => void
}): React.JSX.Element {
  const { status } = delivery
  const step = parcelStep(status)
  const done = status === 'delivered'
  const title = delivery.item || delivery.shop || delivery.mail.subject
  const canOpen = Boolean(delivery.mail.accountId)

  return (
    <article
      className={cn(
        'sheen grid gap-4 rounded-2xl border border-hairline/[.08] bg-glass/50 p-4 backdrop-blur-xl',
        done && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar
          name={delivery.shop || delivery.mail.fromName}
          address={delivery.mail.fromAddress}
          size={40}
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{title}</span>
            <span
              className={cn(
                'ml-auto shrink-0 rounded-full border px-2 py-px text-xs font-medium',
                status === 'problem'
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : status === 'out_for_delivery' || status === 'pickup'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-hairline/10 bg-hairline/[.04] text-muted-foreground'
              )}
            >
              {PARCEL_LABEL[status]}
            </span>
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {[
              delivery.item && delivery.shop,
              delivery.carrier !== delivery.shop && delivery.carrier,
              delivery.expected && `Expected ${mailDateLabel(delivery.expected, null)}`
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* Ordered → Shipped → Out for delivery → Delivered */}
      <ol className="grid grid-cols-4 gap-1.5" aria-label={`Status: ${PARCEL_LABEL[status]}`}>
        {PARCEL_STEPS.map((label, i) => (
          <li key={label} className="grid gap-1.5">
            <span
              className={cn(
                'h-1 rounded-full',
                i <= step
                  ? status === 'problem' && i === step
                    ? 'bg-destructive'
                    : 'bg-primary'
                  : 'bg-hairline/[.08]'
              )}
            />
            <span
              className={cn(
                'text-[11px]',
                i === step ? 'font-medium text-foreground' : 'text-muted-foreground/70'
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {delivery.trackingNumber && (
          <button
            type="button"
            title="Copy tracking number"
            onClick={() => {
              void navigator.clipboard.writeText(delivery.trackingNumber)
              onCopied('Tracking number copied')
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline/10 bg-hairline/[.04] px-2.5 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {delivery.trackingNumber}
            <Copy className="size-3" />
          </button>
        )}
        <div className="ml-auto flex gap-2">
          {canOpen && (
            <Button variant="ghost" size="sm" onClick={onOpenMail}>
              Open mail
            </Button>
          )}
          {delivery.trackingUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.api.openExternal(delivery.trackingUrl!)}
            >
              <ExternalLink />
              Track
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
