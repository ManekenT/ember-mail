import { ipcMain, shell } from 'electron'

import { deleteAccount, listAccounts, saveAccount } from './accounts'
import { testConnection } from './mail/connection'
import type { MailManager } from './mail/manager'
import { getSenderLogo } from './logos'
import { Analyzer } from './ai/analyzer'
import { addTodoistTask, findExistingTask, listDueTasks, verifyTodoistToken } from './ai/todoist'
import { getSecret, setSecret } from './settings'
import { checkForUpdates, getUpdateState, installUpdate } from './updater'
import type { AccountInput, AiSettings, MailAnalysis, MailFolder } from '../shared/types'

export function registerIpc(mail: MailManager): void {
  const aiSettings = (): AiSettings => ({
    hasClaudeKey: getSecret('claudeKey') !== null,
    hasTodoistToken: getSecret('todoistToken') !== null,
    claudeError: mail.analyzer.error
  })

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

  ipcMain.handle('mail:source', (_event, accountId: string, uid: number, folder?: MailFolder) =>
    mail.connection(accountId).getSource(uid, folder === 'archive' ? 'archive' : 'inbox')
  )

  ipcMain.handle('settings:ai', () => aiSettings())

  ipcMain.handle('settings:claudeKey', async (_event, key: string | null) => {
    const value = key?.trim() || null
    if (value) await Analyzer.verifyKey(value)
    setSecret('claudeKey', value)
    mail.analyzer.configure(value)
    mail.analyzeInbox()
    return aiSettings()
  })

  ipcMain.handle('settings:todoistToken', async (_event, token: string | null) => {
    const value = token?.trim() || null
    if (value) await verifyTodoistToken(value)
    setSecret('todoistToken', value)
    return aiSettings()
  })

  ipcMain.handle('todoist:add', async (_event, analysisKey: string, dateIndex: number) => {
    const token = getSecret('todoistToken')
    if (!token) throw new Error('Add your Todoist token in Settings first.')
    const entry = mail.analyzer.entry(analysisKey)
    const date = entry?.dates[dateIndex]
    if (!entry || !date) throw new Error('This date no longer exists.')
    if (date.todoistTaskId) return entry
    const existing = findExistingTask(await listDueTasks(token), date, entry)
    const taskId = existing?.id ?? (await addTodoistTask(token, date, entry))
    return mail.analyzer.markAddedToTodoist(analysisKey, dateIndex, taskId)
  })

  // Marks dates that already have a matching open task in Todoist, so nothing is added twice.
  ipcMain.handle('todoist:check', async (_event, analysisKeys: string[]) => {
    const token = getSecret('todoistToken')
    const updated: Record<string, MailAnalysis> = {}
    if (!token) return updated
    const pending = analysisKeys.flatMap((key) => {
      const entry = mail.analyzer.entry(key)
      return (entry?.dates ?? [])
        .map((date, index) => ({ key, entry: entry!, date, index }))
        .filter(({ date }) => !date.todoistTaskId)
    })
    if (pending.length === 0) return updated
    const tasks = await listDueTasks(token)
    for (const { key, entry, date, index } of pending) {
      const task = findExistingTask(tasks, date, entry)
      if (task) updated[key] = mail.analyzer.markAddedToTodoist(key, index, task.id)
    }
    return updated
  })

  ipcMain.handle('logos:get', (_event, address: string) => getSenderLogo(address))

  ipcMain.handle('updates:state', () => getUpdateState())
  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:install', () => installUpdate())

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) await shell.openExternal(url)
  })
}
