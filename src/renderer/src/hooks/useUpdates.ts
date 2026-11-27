import { useEffect, useState } from 'react'

import type { UpdateState } from '../../../shared/types'

/** The updater's state, pushed live from the main process. */
export function useUpdates(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let active = true
    void window.api.getUpdateState().then((s) => active && setState(s))
    const unsubscribe = window.api.onUpdateState(setState)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return state
}
