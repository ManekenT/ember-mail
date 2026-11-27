import { BrowserWindow, Notification } from 'electron'

import { getPassword, listAccounts } from '../accounts'
import type { AccountInfo, AccountStatus, MailSummary } from '../../shared/types'
import { AccountConnection } from './connection'

/** Owns one live connection per account and merges their inboxes. */
export class MailManager {
  private connections = new Map<string, AccountConnection>()
  private changeTimer: NodeJS.Timeout | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  startAll(): void {
    for (const account of listAccounts()) this.startAccount(account)
  }

  startAccount(account: AccountInfo): void {
    const connection = new AccountConnection(account, getPassword(account.id), {
      onChange: () => this.notifyChanged(),
      onNewMail: (mail) => this.showNotification(account, mail)
    })
    this.connections.set(account.id, connection)
    connection.start()
  }

  async stopAccount(id: string): Promise<void> {
    const connection = this.connections.get(id)
    this.connections.delete(id)
    await connection?.stop()
    this.notifyChanged()
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.connections.values()].map((c) => c.stop()))
    this.connections.clear()
  }

  statuses(): Record<string, AccountStatus> {
    return Object.fromEntries([...this.connections].map(([id, c]) => [id, c.status]))
  }

  inbox(): MailSummary[] {
    return [...this.connections.values()]
      .flatMap((c) => c.list())
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  connection(accountId: string): AccountConnection {
    const connection = this.connections.get(accountId)
    if (!connection) throw new Error(`Unknown account ${accountId}`)
    return connection
  }

  /** Tells the renderer to refetch, at most every 100 ms. */
  private notifyChanged(): void {
    if (this.changeTimer) return
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null
      this.getWindow()?.webContents.send('inbox:changed')
    }, 100)
  }

  private showNotification(account: AccountInfo, mail: MailSummary): void {
    if (!Notification.isSupported()) return
    const notification = new Notification({
      title: mail.fromName,
      subtitle: account.name,
      body: `${mail.subject}\n${mail.preview}`.slice(0, 200)
    })
    notification.on('click', () => {
      const window = this.getWindow()
      if (!window) return
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
      window.webContents.send('mail:open', mail.accountId, mail.uid)
    })
    notification.show()
  }
}
