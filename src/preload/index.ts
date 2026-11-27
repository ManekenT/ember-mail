import { contextBridge, ipcRenderer } from 'electron'

import type { EmberApi, UpdateState } from '../shared/types'

const api: EmberApi = {
  platform: process.platform,
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  updateAccount: (id, update) => ipcRenderer.invoke('accounts:update', id, update),
  sendMail: (mail) => ipcRenderer.invoke('mail:send', mail),
  getSenderName: () => ipcRenderer.invoke('prefs:senderName'),
  setSenderName: (name) => ipcRenderer.invoke('prefs:setSenderName', name),
  replySuggestions: (accountId, uid, folder) =>
    ipcRenderer.invoke('ai:suggest', accountId, uid, folder),
  draftReply: (request) => ipcRenderer.invoke('ai:draft', request),
  onDraftText: (callback) => {
    const listener = (_event: unknown, requestId: string, text: string): void =>
      callback(requestId, text)
    ipcRenderer.on('ai:draft:text', listener)
    return () => ipcRenderer.removeListener('ai:draft:text', listener)
  },
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  getStatuses: () => ipcRenderer.invoke('accounts:statuses'),
  listInbox: () => ipcRenderer.invoke('inbox:list'),
  listArchive: (limit, query) => ipcRenderer.invoke('archive:list', limit, query),
  getMail: (accountId, uid, folder) => ipcRenderer.invoke('mail:get', accountId, uid, folder),
  archiveMail: (accountId, uid) => ipcRenderer.invoke('mail:archive', accountId, uid),
  moveToInbox: (accountId, archivedUid) =>
    ipcRenderer.invoke('mail:moveToInbox', accountId, archivedUid),
  getSenderLogo: (address) => ipcRenderer.invoke('logos:get', address),
  getUpdateState: () => ipcRenderer.invoke('updates:state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: (callback) => {
    const listener = (_event: unknown, state: UpdateState): void => callback(state)
    ipcRenderer.on('updates:state', listener)
    return () => ipcRenderer.removeListener('updates:state', listener)
  },
  getMailSource: (accountId, uid, folder) =>
    ipcRenderer.invoke('mail:source', accountId, uid, folder),
  getAiSettings: () => ipcRenderer.invoke('settings:ai'),
  setClaudeKey: (key) => ipcRenderer.invoke('settings:claudeKey', key),
  setTodoistToken: (token) => ipcRenderer.invoke('settings:todoistToken', token),
  checkTodoist: (analysisKeys) => ipcRenderer.invoke('todoist:check', analysisKeys),
  addToTodoist: (analysisKey, dateIndex) =>
    ipcRenderer.invoke('todoist:add', analysisKey, dateIndex),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onInboxChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('inbox:changed', listener)
    return () => ipcRenderer.removeListener('inbox:changed', listener)
  },
  onOpenMail: (callback) => {
    const listener = (_event: unknown, accountId: string, uid: number): void =>
      callback(accountId, uid)
    ipcRenderer.on('mail:open', listener)
    return () => ipcRenderer.removeListener('mail:open', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
