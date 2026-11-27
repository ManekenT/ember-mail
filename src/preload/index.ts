import { contextBridge, ipcRenderer } from 'electron'

import type { EmberApi, UpdateState } from '../shared/types'

const api: EmberApi = {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
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
