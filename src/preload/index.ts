import { contextBridge, ipcRenderer } from 'electron'

import type { EmberApi } from '../shared/types'

const api: EmberApi = {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  addAccount: (input) => ipcRenderer.invoke('accounts:add', input),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  getStatuses: () => ipcRenderer.invoke('accounts:statuses'),
  listInbox: () => ipcRenderer.invoke('inbox:list'),
  getMail: (accountId, uid) => ipcRenderer.invoke('mail:get', accountId, uid),
  archiveMail: (accountId, uid) => ipcRenderer.invoke('mail:archive', accountId, uid),
  undoArchive: (accountId, archivedUid) =>
    ipcRenderer.invoke('mail:undoArchive', accountId, archivedUid),
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
