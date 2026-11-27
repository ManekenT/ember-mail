import { ipcMain, shell } from 'electron'

import { deleteAccount, listAccounts, saveAccount } from './accounts'
import { testConnection } from './mail/connection'
import type { MailManager } from './mail/manager'
import type { AccountInput } from '../shared/types'

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

  ipcMain.handle('mail:get', (_event, accountId: string, uid: number) =>
    mail.connection(accountId).getMail(uid)
  )

  ipcMain.handle('mail:archive', async (_event, accountId: string, uid: number) => {
    const result = await mail.connection(accountId).archive(uid)
    return result.archivedUid
  })

  ipcMain.handle('mail:undoArchive', (_event, accountId: string, archivedUid: number) =>
    mail.connection(accountId).undoArchive(archivedUid)
  )

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) await shell.openExternal(url)
  })
}
