import { ipcMain, shell } from 'electron'

import { deleteAccount, listAccounts, saveAccount } from './accounts'
import { testConnection } from './mail/connection'
import type { MailManager } from './mail/manager'
import { getSenderLogo } from './logos'
import { checkForUpdates, getUpdateState, installUpdate } from './updater'
import type { AccountInput, MailFolder } from '../shared/types'

export function registerIpc(mail: MailManager): void {
  ipcMain.handle('accounts:list', () => listAccounts())

  ipcMain.handle('accounts:add', async (_event, input: AccountInput) => {
    await testConnection(input)
    const account = saveAccount(input)
    mail.startAccount(account)
    return account
  })

  ipcMain.handle('accounts:remove', async (_event, id: string) => {
    await mail.stopAccount(id)
    deleteAccount(id)
  })

  ipcMain.handle('accounts:statuses', () => mail.statuses())
  ipcMain.handle('inbox:list', () => mail.inbox())

  ipcMain.handle('archive:list', (_event, limit: number, query?: string) =>
    mail.archive(Math.min(Math.max(1, limit), 2000), query?.trim() || undefined)
  )

  ipcMain.handle('mail:get', (_event, accountId: string, uid: number, folder?: MailFolder) =>
    mail.connection(accountId).getMail(uid, folder === 'archive' ? 'archive' : 'inbox')
  )

  ipcMain.handle('mail:archive', async (_event, accountId: string, uid: number) => {
    const result = await mail.connection(accountId).archive(uid)
    return result.archivedUid
  })

  ipcMain.handle('mail:moveToInbox', (_event, accountId: string, archivedUid: number) =>
    mail.connection(accountId).moveToInbox(archivedUid)
  )

  ipcMain.handle('logos:get', (_event, address: string) => getSenderLogo(address))

  ipcMain.handle('updates:state', () => getUpdateState())
  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:install', () => installUpdate())

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) await shell.openExternal(url)
  })
}
