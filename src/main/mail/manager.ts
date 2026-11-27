import { BrowserWindow, Notification } from 'electron'

import { getPassword, listAccounts } from '../accounts'
import { Analyzer } from '../ai/analyzer'
import { getSecret } from '../settings'
import type { AccountInfo, AccountStatus, ArchivePage, MailSummary } from '../../shared/types'
import { AccountConnection } from './connection'

/** Owns one live connection per account and merges their inboxes. */
export class MailManager {
  private connections = new Map<string, AccountConnection>()
  private changeTimer: NodeJS.Timeout | null = null
  readonly analyzer = new Analyzer(() => this.notifyChanged())

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    void this.analyzer.configure(getSecret('claudeKey'))
  }

  /** Sends every inbox mail without an analysis to Claude. */
  analyzeInbox(): void {
    if (!this.analyzer.enabled) return
    this.analyzer.enqueue(
      [...this.connections.values()].flatMap((c) =>
        c.list().map((mail) => ({ mail, text: c.textFor(mail.uid) }))
      )
    )
  }

  private withAnalysis(mail: MailSummary): MailSummary {
    const analysis = this.analyzer.get(mail)
    return analysis ? { ...mail, analysis } : mail
  }

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
      .map((m) => this.withAnalysis(m))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  /**
   * Archived mail of every connected account. Each account contributes its `limit` most
   * recently archived mails; the combined list is sorted by mail date. Accounts that
   * are offline or fail are left out rather than failing the whole view.
   */
  async archive(limit: number, query?: string): Promise<ArchivePage> {
    const live = [...this.connections.values()].filter((c) => c.status.state === 'live')
    const pages = await Promise.all(
      live.map((c) =>
        c.listArchive(limit, query).catch((error) => {
          console.error(`[${c.account.name}] archive failed`, error)
          return { mails: [], hasMore: false }
        })
      )
    )
    return {
      mails: pages
        .flatMap((p) => p.mails)
        .map((m) => this.withAnalysis(m))
        .sort((a, b) => b.date.localeCompare(a.date)),
      hasMore: pages.some((p) => p.hasMore)
    }
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
      this.analyzeInbox()
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
