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

export interface MailSummary {
  /** `${accountId}:${uid}` */
  key: string
  accountId: string
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

export interface EmberApi {
  listAccounts(): Promise<AccountInfo[]>
  addAccount(input: AccountInput): Promise<AccountInfo>
  removeAccount(id: string): Promise<void>
  getStatuses(): Promise<Record<string, AccountStatus>>
  listInbox(): Promise<MailSummary[]>
  getMail(accountId: string, uid: number): Promise<MailDetail>
  /** Returns the mail's UID in the Archive folder, or null if the server didn't say. */
  archiveMail(accountId: string, uid: number): Promise<number | null>
  undoArchive(accountId: string, archivedUid: number): Promise<void>
  openExternal(url: string): Promise<void>
  /** Called whenever the inbox or an account status changes. Returns an unsubscribe function. */
  onInboxChanged(callback: () => void): () => void
  /** Called when a new-mail notification is clicked. */
  onOpenMail(callback: (accountId: string, uid: number) => void): () => void
}
