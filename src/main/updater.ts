import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

import type { UpdatePhase, UpdateState } from '../shared/types'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
/** "Up to date" shows for a moment, then the button goes back to "Check for updates". */
const UP_TO_DATE_MS = 4000

const { autoUpdater } = electronUpdater
let phase: UpdatePhase = { status: 'idle' }
let resetTimer: NodeJS.Timeout | null = null

/**
 * Checks GitHub Releases for a newer version, downloads it in the background and
 * installs it on quit, or right away from the "Install now" button. In `npm run dev`
 * it reads dev-app-update.yml, so checking and downloading can be tried; installing
 * only works in the installed app.
 */
export function setupAutoUpdates(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = app.isPackaged
  if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true

  autoUpdater.on('checking-for-update', () => setPhase({ status: 'checking' }))
  autoUpdater.on('update-not-available', () => {
    setPhase({ status: 'up-to-date' })
    resetTimer = setTimeout(() => setPhase({ status: 'idle' }), UP_TO_DATE_MS)
  })
  autoUpdater.on('update-available', (info) =>
    setPhase({ status: 'downloading', version: info.version, percent: 0 })
  )
  autoUpdater.on('download-progress', (progress) => {
    const version = phase.status === 'downloading' ? phase.version : ''
    setPhase({ status: 'downloading', version, percent: Math.floor(progress.percent) })
  })
  autoUpdater.on('update-downloaded', (info) =>
    setPhase({ status: 'ready', version: info.version })
  )
  autoUpdater.on('error', (error) => {
    // A failed background check while nothing is shown stays quiet.
    if (phase.status === 'idle') console.error('Update check failed', error)
    else setPhase({ status: 'error', message: friendlyError(error) })
  })

  // Background checks only in the installed app; in dev only on button press.
  if (!app.isPackaged) return
  const check = (): void => {
    if (phase.status === 'downloading' || phase.status === 'ready') return
    autoUpdater.checkForUpdates().catch(() => {
      // Reported through the 'error' event.
    })
  }
  check()
  setInterval(check, CHECK_INTERVAL_MS)
}

export function getUpdateState(): UpdateState {
  return { currentVersion: app.getVersion(), canInstall: app.isPackaged, phase }
}

export async function checkForUpdates(): Promise<void> {
  if (phase.status === 'checking' || phase.status === 'downloading' || phase.status === 'ready') {
    return
  }
  // Show "Checking…" right away; the event comes a moment later.
  setPhase({ status: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setPhase({ status: 'error', message: friendlyError(error) })
  }
}

export function installUpdate(): void {
  if (phase.status !== 'ready' || !app.isPackaged) return
  // Silent install, then start the new version.
  autoUpdater.quitAndInstall(true, true)
}

function setPhase(next: UpdatePhase): void {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = null
  phase = next
  const state = getUpdateState()
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('updates:state', state)
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/ENOTFOUND|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|net::ERR/i.test(message)) {
    return 'No connection to GitHub'
  }
  return 'Update failed'
}
