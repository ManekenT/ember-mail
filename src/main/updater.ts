import { app } from 'electron'
import electronUpdater from 'electron-updater'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/**
 * Checks GitHub Releases for a newer version, downloads it in the background
 * and installs it the next time the app quits. Only runs in the installed app,
 * not in `npm run dev`.
 */
export function setupAutoUpdates(): void {
  if (!app.isPackaged) return

  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const check = (): void => {
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
      console.error('Update check failed', error)
    })
  }

  check()
  setInterval(check, CHECK_INTERVAL_MS)
}
