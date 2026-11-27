import type { ParcelStatus } from '../../../shared/types'

export const PARCEL_LABEL: Record<ParcelStatus, string> = {
  ordered: 'Ordered',
  shipped: 'On its way',
  out_for_delivery: 'Arrives today',
  pickup: 'Ready for pickup',
  delivered: 'Delivered',
  problem: 'Problem'
}

/** The steps of a normal delivery; pickup and problem sit at the shipped step. */
export const PARCEL_STEPS = ['Ordered', 'Shipped', 'Out for delivery', 'Delivered'] as const

export function parcelStep(status: ParcelStatus): number {
  switch (status) {
    case 'ordered':
      return 0
    case 'shipped':
    case 'problem':
      return 1
    case 'out_for_delivery':
    case 'pickup':
      return 2
    case 'delivered':
      return 3
  }
}
