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
/** How much of a mail's text is kept for Claude's analysis. */
const ANALYSIS_TEXT_CHARS = 8_000
const RECONNECT_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

export interface ArchiveResult {
  archivePath: string
  archivedUid: number | null
}

export interface ConnectionEvents {
  onChange: () => void
  onNewMail: (mail: MailSummary) => void
}

type Folder = MailSummary['folder']

/**
 * One live IMAP connection per account. Keeps INBOX selected so the server can
 * push changes (IDLE), and keeps an in-memory list of the INBOX messages.
 * Every command runs under a mailbox lock, so a quick look into the Archive
 * folder never mixes with inbox commands; afterwards INBOX is selected again.
 */
export class AccountConnection {
  status: AccountStatus = { state: 'connecting' }
  private client: ImapFlow | null = null
  private messages = new Map<number, MailSummary>()
  /** Plain text of the inbox mails (from the first PREVIEW_BYTES), for analysis. */
  private texts = new Map<number, string>()
  /** Summaries of archived mails already fetched, by UID, for "Load more". */
  private archived = new Map<number, MailSummary>()
  private archiveUidValidity: bigint | null = null
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

  /** The start of an inbox mail's text, for analysis. */
  textFor(uid: number): string {
    return this.texts.get(uid) ?? ''
  }

  /** The raw source of a mail, as the server stores it. Doesn't mark it read. */
  async getSource(uid: number, folder: Folder = 'inbox'): Promise<string> {
    const path = folder === 'archive' ? await this.findArchiveFolder() : INBOX
    return this.inFolder(path, async (client) => {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error('This mail no longer exists.')
      return message.source.toString('utf8')
    })
  }

  async getMail(uid: number, folder: Folder = 'inbox'): Promise<MailDetail> {
    const path = folder === 'archive' ? await this.findArchiveFolder() : INBOX
    const parsed = await this.inFolder(path, async (client) => {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!message || !message.source) throw new Error('This mail no longer exists.')

      const summary = folder === 'inbox' ? this.messages.get(uid) : this.archived.get(uid)
      if (summary?.unread) {
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
        summary.unread = false
        this.events.onChange()
      }
      return simpleParser(message.source)
    })

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
    const archivePath = await this.findArchiveFolder()
    const moved = await this.inFolder(INBOX, (client) =>
      client.messageMove(String(uid), archivePath, { uid: true })
    )
    if (!moved) throw new Error('The mail could not be moved to the archive.')
    this.messages.delete(uid)
    this.texts.delete(uid)
    this.events.onChange()
    return { archivePath, archivedUid: moved.uidMap?.get(uid) ?? null }
  }

  /** Moves an archived mail back to the inbox. Returns its new inbox UID, if the server said. */
  async moveToInbox(archivedUid: number): Promise<number | null> {
    const archivePath = await this.findArchiveFolder()
    const inboxUid = await this.inFolder(archivePath, async (client) => {
      const moved = await client.messageMove(String(archivedUid), INBOX, { uid: true })
      if (!moved) throw new Error('The mail could not be moved to the inbox.')
      const uid = moved.uidMap?.get(archivedUid)
      if (uid !== undefined) this.quietUids.add(uid)
      return uid ?? null
    })
    this.archived.delete(archivedUid)
    await this.sync()
    return inboxUid
  }

  /**
   * The newest `limit` archived mails, by archive order (newest UID first). With a
   * query, the server searches sender, subject and body instead.
   */
  async listArchive(
    limit: number,
    query?: string
  ): Promise<{ mails: MailSummary[]; hasMore: boolean }> {
    const archivePath = await this.findArchiveFolder()
    return this.inFolder(archivePath, async (client) => {
      const validity = client.mailbox ? client.mailbox.uidValidity : null
      if (validity !== this.archiveUidValidity) {
        this.archived.clear()
        this.archiveUidValidity = validity
      }

      const criteria = query
        ? { or: [{ from: query }, { subject: query }, { body: query }] }
        : { all: true }
      const found = (await client.search(criteria, { uid: true })) || []
      const uids = found.sort((a, b) => b - a)
      const page = uids.slice(0, limit)

      const missing = page.filter((uid) => !this.archived.has(uid))
      if (missing.length > 0) {
        const fetched = await client.fetchAll(missing.join(','), SUMMARY_QUERY, { uid: true })
        for (const message of fetched) {
          this.archived.set(message.uid, await this.toSummary(message, 'archive'))
        }
      }

      const mails = page.flatMap((uid) => this.archived.get(uid) ?? [])
      return { mails, hasMore: uids.length > page.length }
    })
  }

  private requireClient(): ImapFlow {
    if (!this.client || this.status.state !== 'live') {
      throw new Error(`${this.account.name} is not connected right now.`)
    }
    return this.client
  }

  /** Runs `task` with `path` selected. Leaving another folder goes back to watching INBOX. */
  private async inFolder<T>(path: string, task: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.requireClient()
    const lock = await client.getMailboxLock(path)
    try {
      return await task(client)
    } finally {
      lock.release()
      if (path !== INBOX) {
        // Select INBOX again so IDLE watches it, and catch up on anything missed.
        const back = await client.getMailboxLock(INBOX).catch(() => null)
        back?.release()
        this.queueSync()
      }
    }
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

    // Only react to the inbox; the Archive folder is opened briefly to browse or restore.
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
    if (!this.client || this.status.state !== 'live') return
    const run = this.inFolder(INBOX, (client) => this.syncOnce(client))
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
    if (!mailbox || mailbox.exists === 0) {
      this.messages.clear()
      this.texts.clear()
      this.initialSyncDone = true
      this.events.onChange()
      return
    }

    // Current UIDs and flags of the newest messages.
    const first = Math.max(1, mailbox.exists - MAX_MESSAGES + 1)
    const current = await client.fetchAll(`${first}:*`, { uid: true, flags: true })
    const currentUids = new Set(current.map((m) => m.uid))

    for (const uid of this.messages.keys()) {
      if (!currentUids.has(uid)) {
        this.messages.delete(uid)
        this.texts.delete(uid)
      }
    }
    for (const m of current) {
      const known = this.messages.get(m.uid)
      if (known) known.unread = !m.flags?.has('\\Seen')
    }

    const newUids = current.filter((m) => !this.messages.has(m.uid)).map((m) => m.uid)
    const added: MailSummary[] = []
    if (newUids.length > 0) {
      const fetched = await client.fetchAll(newUids.join(','), SUMMARY_QUERY, { uid: true })
      for (const message of fetched) {
        const summary = await this.toSummary(message, 'inbox')
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

  private async toSummary(message: FetchMessageObject, folder: Folder): Promise<MailSummary> {
    const from = message.envelope?.from?.[0]
    const date = message.envelope?.date ?? message.internalDate ?? new Date()
    const text = cleanPreview(message.source ? await bodyText(message.source) : '')
    if (folder === 'inbox') this.texts.set(message.uid, text.slice(0, ANALYSIS_TEXT_CHARS))
    return {
      key: `${this.account.id}:${folder}:${message.uid}`,
      accountId: this.account.id,
      folder,
      uid: message.uid,
      fromName: from?.name || from?.address || 'Unknown sender',
      fromAddress: from?.address ?? '',
      subject: message.envelope?.subject || '(no subject)',
      preview: text.slice(0, 240),
      date: new Date(date).toISOString(),
      unread: !message.flags?.has('\\Seen'),
      messageId: message.envelope?.messageId || undefined
    }
  }

  private async findArchiveFolder(): Promise<string> {
    if (this.archivePath) return this.archivePath
    const client = this.requireClient()
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

const SUMMARY_QUERY = {
  uid: true,
  flags: true,
  envelope: true,
  internalDate: true,
  source: { maxLength: PREVIEW_BYTES }
} as const

/** The plain text of a mail's first PREVIEW_BYTES. */
async function bodyText(source: Buffer): Promise<string> {
  try {
    // The source is cut off after PREVIEW_BYTES; the parser copes with that.
    const parsed = await simpleParser(source, { skipImageLinks: true, skipTextLinks: true })
    return parsed.text ?? (typeof parsed.html === 'string' ? stripTags(parsed.html) : '')
  } catch {
    return ''
  }
}

/**
 * Plain-text parts of HTML newsletters are full of image and link URLs, like
 * "[https://example.com/logo.png] https://example.com". Those say nothing in a preview.
 */
export function cleanPreview(text: string): string {
  return text
    .replace(/\[\s*(?:https?:|mailto:|cid:|www\.)[^\]]*\]/gi, ' ') // [https://…] image placeholders
    .replace(/<\s*(?:https?:|mailto:|www\.)[^>]*>/gi, ' ') // <https://…>
    .replace(/\(\s*(?:https?:|mailto:|www\.)[^)]*\)/gi, ' ') // (https://…)
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ') // bare URLs
    .replace(/\[\s*(?:(?:image|img|bild)\b[^\]]*)?\]/gi, ' ') // "[image: Logo]" and empty []
    .replace(/([-=_*~#|])\1{2,}/g, ' ') // divider lines like ------ or ====
    .replace(/\s+/g, ' ')
    .trim()
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
