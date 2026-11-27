import { useEffect, useState } from 'react'

import type { SenderLogo } from '../../../shared/types'

/** One request per address for the whole session; the main process caches on disk. */
const cache = new Map<string, Promise<SenderLogo | null>>()
const resolved = new Map<string, SenderLogo | null>()

function load(address: string): Promise<SenderLogo | null> {
  let request = cache.get(address)
  if (!request) {
    request = window.api
      .getSenderLogo(address)
      .catch(() => null)
      .then((logo) => {
        resolved.set(address, logo)
        return logo
      })
    cache.set(address, request)
  }
  return request
}

/** The sender's brand logo, or null while loading and when there is none. */
export function useSenderLogo(address: string | undefined): SenderLogo | null {
  const key = address?.toLowerCase() ?? ''
  const [logo, setLogo] = useState<{ key: string; logo: SenderLogo | null }>(() => ({
    key,
    logo: resolved.get(key) ?? null
  }))

  useEffect(() => {
    if (!key) return
    let active = true
    void load(key).then((result) => active && setLogo({ key, logo: result }))
    return () => {
      active = false
    }
  }, [key])

  if (logo.key === key) return logo.logo
  return resolved.get(key) ?? null
}
