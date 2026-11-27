// Types shared by the main process, preload and renderer.

export interface AccountInput {
  name: string
  email: string
  host: string
  port: number
  secure: boolean
  user: string
  password: string
}

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
  /** Sanitized in the renderer before display. Null for text-only mails. */
  html: string | null
  text: string
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
  openExternal(url: string): Promise<void>
  /** Called whenever the inbox or an account status changes. Returns an unsubscribe function. */
  onInboxChanged(callback: () => void): () => void
  /** Called when a new-mail notification is clicked. */
  onOpenMail(callback: (accountId: string, uid: number) => void): () => void
}
