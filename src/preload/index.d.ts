import type { EmberApi } from '../shared/types'

declare global {
  interface Window {
    api: EmberApi
  }
}
