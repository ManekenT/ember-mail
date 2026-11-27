import { useCallback, useEffect, useState } from 'react'

import type { Delivery } from '../../../shared/types'

/** Orders and parcels from the mail analyses; refreshed whenever the inbox changes. */
export function useDeliveries(): Delivery[] {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])

  const refresh = useCallback(() => {
    window.api
      .listDeliveries()
      .then(setDeliveries)
      .catch((e) => console.error('deliveries', e))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.onInboxChanged(refresh)
  }, [refresh])

  return deliveries
}
