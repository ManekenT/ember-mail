// Types shared by the main process, preload and renderer.

export interface AccountInput {
  name: string
  email: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  smtpHost: string
  smtpPort: number
  /** True: TLS from the start (465). False: STARTTLS (587). */
  smtpSecure: boolean
}

/** Changes to an account. A password is only sent when it changes. */
export type AccountUpdate = Omit<AccountInput, 'password'> & { password?: string }

/** An account as the renderer sees it. The password never leaves the main process. */
export interface AccountInfo {
  id: string
  name: string
  email: string
  host: string
  port: number
  secure: boolean
  user: string
  colorIndex: number
  /** Empty when sending isn't set up yet (accounts from before sending existed). */
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  /** Other addresses this account has sent from (aliases on the same mailbox). */
  addresses: string[]
}

export type AccountStatus =
  { state: 'connecting' } | { state: 'live' } | { state: 'error'; message: string }

export type MailFolder = 'inbox' | 'archive'

export interface MailSummary {
  /** `${accountId}:${folder}:${uid}`, unique across folders. */
  key: string
  accountId: string
  folder: MailFolder
  uid: number
  fromName: string
  fromAddress: string
  subject: string
  preview: string
  /** ISO date */
  date: string
  unread: boolean
  /** The Message-ID header, which stays the same when the mail moves between folders. */
  messageId?: string
  /** Claude's analysis of the mail, once there is one. Follows the mail into the archive. */
  analysis?: MailAnalysis
}

export type MailCategory =
  | 'personal'
  | 'work'
  | 'finance'
  | 'shopping'
  | 'travel'
  | 'event'
  | 'newsletter'
  | 'notification'
  | 'promotion'
  | 'spam'

/** none: nothing special. important: worth reading soon. urgent: needs action soon. */
export type Urgency = 'none' | 'important' | 'urgent'

export interface MailDate {
  /** Short task-like title, e.g. "Dentist appointment". */
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM (24h, the mail's local time), or null for all-day. */
  time: string | null
  kind: 'event' | 'deadline' | 'expiry'
  /** Set once added to Todoist. */
  todoistTaskId?: string
}

export interface MailAnalysis {
  /** Key in the analysis store (Message-ID based), used to update this analysis. */
  key: string
  summary: string
  category: MailCategory
  urgency: Urgency
  /** Why the mail is important or urgent; null when urgency is none. */
  urgencyReason: string | null
  dates: MailDate[]
  /** YYYY-MM-DD after which the mail is no longer relevant, or null. */
  expiresOn: string | null
  /** No lasting value once read (promotions, newsletters, notifications, codes). */
  disposable: boolean
}

export interface AiSettings {
  hasClaudeKey: boolean
  hasTodoistToken: boolean
  /** Why analysis is paused (e.g. the key was rejected), or null. */
  claudeError: string | null
}

export interface MailAddress {
  name: string
  address: string
}

export interface MailDetail {
  accountId: string
  uid: number
  subject: string
  from: MailAddress[]
  to: MailAddress[]
  cc: MailAddress[]
  date: string
  replyTo: MailAddress[]
  /** Message-ID and References headers, for threading replies. */
  messageId: string | null
  references: string[]
  /** Sanitized in the renderer before display. Null for text-only mails. */
  html: string | null
  text: string
}

export interface OutgoingMail {
  accountId: string
  /** The address to send from: the account's own or another one it may use. */
  from: string
  /** Comma-separated addresses, as typed. */
  to: string
  cc: string
  subject: string
  text: string
  /** Set when this is a reply: the mail it answers. */
  replyTo?: { uid: number; folder: MailFolder }
}

export interface DraftRequest {
  /** Chosen by the renderer, to match onDraftText updates to this request. */
  requestId: string
  accountId: string
  uid: number
  folder: MailFolder
  /** What the reply should say, in Tom's words; may be empty. */
  instruction: string
  /** The sender address the reply goes out from. */
  from: string
}

export interface ArchivePage {
  mails: MailSummary[]
  /** True when at least one account has older archived mail to load. */
  hasMore: boolean
}

export interface SenderLogo {
  /** data: URL of the image. */
  src: string
  /** Square brand artwork (BIMI, touch icon) that can fill the avatar; favicons get padding. */
  fullBleed: boolean
}

export type UpdatePhase =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string }

export interface UpdateState {
  currentVersion: string
  /** False in `npm run dev`: updates can be checked and downloaded there, not installed. */
  canInstall: boolean
  phase: UpdatePhase
}

export interface EmberApi {
  /** process.platform: the title bar leaves room for the native window buttons. */
  platform: string
  listAccounts(): Promise<AccountInfo[]>
  addAccount(input: AccountInput): Promise<AccountInfo>
  updateAccount(id: string, update: AccountUpdate): Promise<AccountInfo>
  removeAccount(id: string): Promise<void>
  getStatuses(): Promise<Record<string, AccountStatus>>
  listInbox(): Promise<MailSummary[]>
  /**
   * Archived mail of all accounts, newest archived first per account. `limit` grows with
   * "Load more". With a query, searches the archive on the server instead.
   */
  listArchive(limit: number, query?: string): Promise<ArchivePage>
  getMail(accountId: string, uid: number, folder?: MailFolder): Promise<MailDetail>
  /** Returns the mail's UID in the Archive folder, or null if the server didn't say. */
  archiveMail(accountId: string, uid: number): Promise<number | null>
  /** Moves an archived mail back to the inbox. Returns its new inbox UID, or null. */
  moveToInbox(accountId: string, archivedUid: number): Promise<number | null>
  /** The sender domain's logo, cached on disk. Null when there is none (show initials). */
  getSenderLogo(address: string): Promise<SenderLogo | null>
  getUpdateState(): Promise<UpdateState>
  /** Checks now; downloads right away when an update is found. */
  checkForUpdates(): Promise<void>
  /** Restarts into the downloaded update. */
  installUpdate(): Promise<void>
  onUpdateState(callback: (state: UpdateState) => void): () => void
  sendMail(mail: OutgoingMail): Promise<void>
  /** Sender name for outgoing mail ("Tom Hohendorf"), empty when not set. */
  getSenderName(): Promise<string>
  setSenderName(name: string): Promise<void>
  /** Two to four short reply ideas for a mail, from Claude. */
  replySuggestions(accountId: string, uid: number, folder: MailFolder): Promise<string[]>
  /**
   * Has Claude write a reply. Text arrives through onDraftText while it is written;
   * resolves with the whole draft.
   */
  draftReply(request: DraftRequest): Promise<string>
  onDraftText(callback: (requestId: string, text: string) => void): () => void
  /** The mail's raw source (headers and MIME body) as text. */
  getMailSource(accountId: string, uid: number, folder?: MailFolder): Promise<string>
  getAiSettings(): Promise<AiSettings>
  /** Checks the key with Anthropic, then stores it encrypted. Null removes it. */
  setClaudeKey(key: string | null): Promise<AiSettings>
  /** Checks the token with Todoist, then stores it encrypted. Null removes it. */
  setTodoistToken(token: string | null): Promise<AiSettings>
  /**
   * Looks in Todoist for open tasks that already cover these analyses' dates and marks
   * them as added. Returns the analyses that changed, by key.
   */
  checkTodoist(analysisKeys: string[]): Promise<Record<string, MailAnalysis>>
  /** Adds one of the mail's dates to Todoist. Returns the updated analysis. */
  addToTodoist(analysisKey: string, dateIndex: number): Promise<MailAnalysis>
  openExternal(url: string): Promise<void>
  /** Called whenever the inbox or an account status changes. Returns an unsubscribe function. */
  onInboxChanged(callback: () => void): () => void
  /** Called when a new-mail notification is clicked. */
  onOpenMail(callback: (accountId: string, uid: number) => void): () => void
}
