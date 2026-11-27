import type { Delivery, Parcel, ParcelStatus } from '../../shared/types'
import type { StoredAnalysis } from './analyzer'

/** Delivered parcels stay in the list this long, so "it arrived" is still visible. */
const DELIVERED_DAYS = 3
/** Parcels with no news for this long are taken as done (the delivered mail never came). */
const STALE_DAYS = 30

const ORDER: ParcelStatus[] = [
  'out_for_delivery',
  'problem',
  'pickup',
  'shipped',
  'ordered',
  'delivered'
]

interface Update {
  key: string
  stored: StoredAnalysis
  parcel: Parcel
  date: string
}

const norm = (text: string): string => text.trim().toLowerCase()

const words = (text: string): Set<string> =>
  new Set(
    norm(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3)
  )

/** Two item descriptions that may be the same order (one unknown counts as a match). */
function sameItem(a: string, b: string): boolean {
  if (!a || !b) return true
  const other = words(b)
  return [...words(a)].some((w) => other.has(w))
}

/** Same parcel: same tracking number; or, without one, same shop and item. */
function groupKey(update: Update): string {
  const { parcel, stored } = update
  if (parcel.trackingNumber) return `t:${parcel.trackingNumber.toUpperCase()}`
  if (parcel.shop || parcel.item) return `s:${norm(parcel.shop)}|${norm(parcel.item)}`
  return `m:${update.key}|${stored.subject}`
}

/**
 * Orders and parcels from the stored analyses, one per parcel, with the newest status.
 * An order confirmation without a tracking number joins the shop's later shipment.
 */
export function buildDeliveries(
  entries: Array<[string, StoredAnalysis]>,
  now = new Date()
): Delivery[] {
  const updates: Update[] = entries
    .flatMap(([key, stored]) =>
      stored.parcel
        ? [{ key, stored, parcel: stored.parcel, date: stored.mailDate ?? stored.analyzedAt }]
        : []
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  const groups = new Map<string, Update[]>()
  for (const update of updates) {
    const key = groupKey(update)
    groups.set(key, [...(groups.get(key) ?? []), update])
  }

  // Attach orders without tracking to a later tracked parcel from the same shop.
  for (const [key, group] of [...groups]) {
    if (!key.startsWith('s:')) continue
    const first = group[0]
    if (!first.parcel.shop) continue
    const target = [...groups].find(
      ([other, list]) =>
        other.startsWith('t:') &&
        norm(list[0].parcel.shop) === norm(first.parcel.shop) &&
        list[list.length - 1].date >= first.date &&
        sameItem(first.parcel.item, list.find((u) => u.parcel.item)?.parcel.item ?? '')
    )
    if (target) {
      target[1].unshift(...group)
      target[1].sort((a, b) => a.date.localeCompare(b.date))
      groups.delete(key)
    }
  }

  const day = 86_400_000
  const deliveries: Delivery[] = []
  for (const [id, group] of groups) {
    const latest = group[group.length - 1]
    // Fields a later mail leaves out come from earlier ones.
    const pick = <K extends keyof Parcel>(field: K): Parcel[K] => {
      for (let i = group.length - 1; i >= 0; i--) {
        const value = group[i].parcel[field]
        if (value) return value
      }
      return latest.parcel[field]
    }
    const age = (now.getTime() - new Date(latest.date).getTime()) / day
    const status = latest.parcel.status
    if (status === 'delivered' ? age > DELIVERED_DAYS : age > STALE_DAYS) continue
    deliveries.push({
      id,
      status,
      carrier: pick('carrier'),
      trackingNumber: pick('trackingNumber'),
      trackingUrl: pick('trackingUrl'),
      item: pick('item'),
      shop: pick('shop'),
      expected: status === 'delivered' ? null : (latest.parcel.expected ?? pick('expected')),
      updatedAt: latest.date,
      mail: {
        analysisKey: latest.key,
        accountId: latest.stored.accountId ?? null,
        messageId: latest.stored.messageId ?? null,
        fromName: latest.stored.fromName,
        fromAddress: latest.stored.fromAddress ?? '',
        subject: latest.stored.subject
      }
    })
  }

  return deliveries.sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      (a.expected ?? '9999').localeCompare(b.expected ?? '9999') ||
      b.updatedAt.localeCompare(a.updatedAt)
  )
}
