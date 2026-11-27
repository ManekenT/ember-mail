import { ImapFlow, type FetchMessageObject } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'

import type {
  AccountInfo,
  AccountStatus,
  MailAddress,
  MailDetail,
  MailSummary
} from '../../shared/types'

const INBOX = 'INBOX'
/** Only the newest messages are kept in the list; Inbox Zero inboxes stay small anyway. */
const MAX_MESSAGES = 500
const PREVIEW_BYTES = 16 * 1024
const RECONNECT_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

export interface ArchiveResult {
  archivePath: string
  archivedUid: number | null
}

export interface ConnectionEvents {
  onChange: () => void
  onNewMail: (mail: MailSummary) => void
}

/**
 * One live IMAP connection per account. Keeps INBOX selected so the server can
 * push changes (IDLE), and keeps an in-memory list of the INBOX messages.
 */
export class AccountConnection {
  status: AccountStatus = { state: 'connecting' }
  private client: ImapFlow | null = null
  private messages = new Map<number, MailSummary>()
  private archivePath: string | null = null
  private initialSyncDone = false
  /** UIDs that reappear in the inbox because of an undo; no notification for those. */
  private quietUids = new Set<number>()
  private syncQueued = false
  private syncRunning: Promise<void> | null = null
  private reconnectAttempt = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private stopped = false

  constructor(
    readonly account: AccountInfo,
    private readonly password: string,
    private readonly events: ConnectionEvents
  ) {}

  start(): void {
    void this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const client = this.client
    this.client = null
    if (client) await client.logout().catch(() => client.close())
  }

  list(): MailSummary[] {
    return [...this.messages.values()]
  }

  async getMail(uid: number): Promise<MailDetail> {
    const client = this.requireClient()
    const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
    if (!message || !message.source) throw new Error('This mail no longer exists.')
    const parsed = await simpleParser(message.source)

    const summary = this.messages.get(uid)
    if (summary?.unread) {
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      this.messages.set(uid, { ...summary, unread: false })
      this.events.onChange()
    }

    return {
      accountId: this.account.id,
      uid,
      subject: parsed.subject ?? '(no subject)',
      from: addresses(parsed.from),
      to: addresses(parsed.to),
      cc: addresses(parsed.cc),
      date: (parsed.date ?? new Date()).toISOString(),
      html: typeof parsed.html === 'string' ? parsed.html : null,
      text: parsed.text ?? ''
    }
  }

  /**
   * Moves the mail to the account's Archive folder. Never deletes. Returns the
   * mail's UID in the archive (when the server reports it) so it can be undone.
   */
  async archive(uid: number): Promise<ArchiveResult> {
    const client = this.requireClient()
    const archivePath = await this.findArchiveFolder(client)
    const moved = await client.messageMove(String(uid), archivePath, { uid: true })
    if (!moved) throw new Error('The mail could not be moved to the archive.')
    this.messages.delete(uid)
    this.events.onChange()
    return { archivePath, archivedUid: moved.uidMap?.get(uid) ?? null }
  }

  /** Moves an archived mail back to the inbox. */
  async undoArchive(archivedUid: number): Promise<void> {
    const client = this.requireClient()
    const archivePath = await this.findArchiveFolder(client)
    const lock = await client.getMailboxLock(archivePath)
    try {
      const moved = await client.messageMove(String(archivedUid), INBOX, { uid: true })
      const inboxUid = moved ? moved.uidMap?.get(archivedUid) : undefined
      if (inboxUid !== undefined) this.quietUids.add(inboxUid)
    } finally {
      lock.release()
      // Go back to watching the inbox.
      await client.mailboxOpen(INBOX)
    }
    await this.sync()
  }

  private requireClient(): ImapFlow {
    if (!this.client || this.status.state !== 'live') {
      throw new Error(`${this.account.name} is not connected right now.`)
    }
    return this.client
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    this.setStatus({ state: 'connecting' })

    const client = new ImapFlow({
      host: this.account.host,
      port: this.account.port,
      secure: this.account.secure,
      auth: { user: this.account.user, pass: this.password },
      logger: false,
      // Start IDLE about a second after the last command, so new mail shows up right away.
      autoIdleDelay: 1000
    })
    this.client = client

    // Only react to the inbox; undo briefly opens the Archive folder.
    client.on('exists', (event) => event.path === INBOX && this.queueSync())
    client.on('expunge', (event) => event.path === INBOX && this.queueSync())
    client.on('flags', (event) => event.path === INBOX && this.queueSync())
    client.on('error', (error: Error) => console.error(`[${this.account.name}]`, error.message))
    client.on('close', () => {
      if (this.client === client) this.scheduleReconnect()
    })

    try {
      await client.connect()
      await client.mailboxOpen(INBOX)
      this.reconnectAttempt = 0
      this.setStatus({ state: 'live' })
      await this.sync()
    } catch (error) {
      this.setStatus({ state: 'error', message: errorMessage(error) })
      client.close()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    if (this.status.state === 'live') this.setStatus({ state: 'connecting' })
    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => void this.connect(), delay)
  }

  private setStatus(status: AccountStatus): void {
    this.status = status
    this.events.onChange()
  }

  /** Coalesces bursts of server events into one sync. */
  private queueSync(): void {
    if (this.syncRunning) {
      this.syncQueued = true
      return
    }
    void this.sync()
  }

  private async sync(): Promise<void> {
    const client = this.client
    if (!client) return
    const run = this.syncOnce(client)
      .catch((error) => console.error(`[${this.account.name}] sync failed`, error))
      .finally(() => {
        this.syncRunning = null
        if (this.syncQueued) {
          this.syncQueued = false
          void this.sync()
        }
      })
    this.syncRunning = run
    await run
  }

  private async syncOnce(client: ImapFlow): Promise<void> {
    const mailbox = client.mailbox
    // Another folder is open for a moment (undo); the inbox is synced again afterwards.
    if (mailbox && mailbox.path !== INBOX) return
    if (!mailbox || mailbox.exists === 0) {
      this.messages.clear()
      this.initialSyncDone = true
      this.events.onChange()
      return
    }

    // Current UIDs and flags of the newest messages.
    const first = Math.max(1, mailbox.exists - MAX_MESSAGES + 1)
    const current = await client.fetchAll(`${first}:*`, { uid: true, flags: true })
    const currentUids = new Set(current.map((m) => m.uid))

    for (const uid of this.messages.keys()) {
      if (!currentUids.has(uid)) this.messages.delete(uid)
    }
    for (const m of current) {
      const known = this.messages.get(m.uid)
      if (known) known.unread = !m.flags?.has('\\Seen')
    }

    const newUids = current.filter((m) => !this.messages.has(m.uid)).map((m) => m.uid)
    const added: MailSummary[] = []
    if (newUids.length > 0) {
      const fetched = await client.fetchAll(
        newUids.join(','),
        {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
          source: { maxLength: PREVIEW_BYTES }
        },
        { uid: true }
      )
      for (const message of fetched) {
        const summary = await this.toSummary(message)
        this.messages.set(summary.uid, summary)
        added.push(summary)
      }
    }

    this.events.onChange()
    if (this.initialSyncDone) {
      for (const mail of added) {
        if (mail.unread && !this.quietUids.has(mail.uid)) this.events.onNewMail(mail)
      }
    }
    this.initialSyncDone = true
    this.quietUids.clear()
  }

  private async toSummary(message: FetchMessageObject): Promise<MailSummary> {
    const from = message.envelope?.from?.[0]
    const date = message.envelope?.date ?? message.internalDate ?? new Date()
    return {
      key: `${this.account.id}:${message.uid}`,
      accountId: this.account.id,
      uid: message.uid,
      fromName: from?.name || from?.address || 'Unknown sender',
      fromAddress: from?.address ?? '',
      subject: message.envelope?.subject || '(no subject)',
      preview: message.source ? await previewText(message.source) : '',
      date: new Date(date).toISOString(),
      unread: !message.flags?.has('\\Seen')
    }
  }

  private async findArchiveFolder(client: ImapFlow): Promise<string> {
    if (this.archivePath) return this.archivePath
    const folders = await client.list()
    const found =
      folders.find((f) => f.specialUse === '\\Archive') ??
      folders.find((f) => f.name.toLowerCase() === 'archive') ??
      folders.find((f) => f.name.toLowerCase() === 'archiv')
    if (found) {
      this.archivePath = found.path
    } else {
      const created = await client.mailboxCreate('Archive')
      this.archivePath = created.path
    }
    return this.archivePath
  }
}

async function previewText(source: Buffer): Promise<string> {
  try {
    // The source is cut off after PREVIEW_BYTES; the parser copes with that.
    const parsed = await simpleParser(source, { skipImageLinks: true, skipTextLinks: true })
    const text = parsed.text ?? (typeof parsed.html === 'string' ? stripTags(parsed.html) : '')
    return text.replace(/\s+/g, ' ').trim().slice(0, 240)
  } catch {
    return ''
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
}

function addresses(value: AddressObject | AddressObject[] | undefined): MailAddress[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : [value]
  return list.flatMap((group) =>
    group.value.map((a) => ({ name: a.name ?? '', address: a.address ?? '' }))
  )
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as {
      authenticationFailed?: boolean
      code?: string
      responseText?: string
      message?: string
    }
    if (e.authenticationFailed) return 'Login failed. Check the username and password.'
    if (e.code?.startsWith('ERR_SSL') || e.code === 'EPROTO') {
      return 'Secure connection failed. Check the port, or the SSL/TLS setting.'
    }
    if (e.code === 'ENOTFOUND') return 'Server not found. Check the IMAP server name.'
    if (e.code === 'ECONNREFUSED') return 'The server refused the connection. Check the port.'
    if (e.code === 'ETIMEDOUT' || e.code === 'ConnectionTimeout') {
      return 'The server did not answer. Check the server name and port.'
    }
    if (e.responseText) return e.responseText
    if (e.message) return e.message
  }
  return String(error)
}

/** Connects once with the given settings to check they work, then logs out. */
export async function testConnection(options: {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}): Promise<void> {
  const client = new ImapFlow({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: { user: options.user, pass: options.password },
    logger: false
  })
  try {
    await client.connect()
    await client.mailboxOpen(INBOX, { readOnly: true })
    await client.logout()
  } catch (error) {
    client.close()
    throw new Error(errorMessage(error), { cause: error })
  }
}
