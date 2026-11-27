import { createTransport } from 'nodemailer'

import type { AccountInfo, MailDetail, OutgoingMail } from '../../shared/types'

/** Splits "a@x.de, Bob <b@y.de>; c@z.de" into single recipients, and checks each. */
export function parseRecipients(value: string): string[] {
  const list = value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
  for (const entry of list) {
    const address = entry.match(/<([^>]+)>/)?.[1] ?? entry
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address.trim())) {
      throw new Error(`"${entry}" is not an email address.`)
    }
  }
  return list
}

function smtpOptions(
  account: Pick<AccountInfo, 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'user'>,
  password: string
): { host: string; port: number; secure: boolean; auth: { user: string; pass: string } } {
  return {
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: { user: account.user, pass: password }
  }
}

/** The quoted original under a reply. */
function quote(original: MailDetail): string {
  const sender = original.from[0]
  const who = sender ? sender.name || sender.address : 'Someone'
  const when = new Date(original.date).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  const body = original.text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return `\n\nOn ${when}, ${who} wrote:\n${body}`
}

/**
 * Builds the mail, sends it over SMTP and returns the raw message (for the Sent folder).
 * For replies, `original` sets the threading headers and the quote.
 */
export async function sendViaSmtp(
  account: AccountInfo,
  password: string,
  senderName: string,
  mail: OutgoingMail,
  original: MailDetail | null
): Promise<Buffer> {
  if (!account.smtpHost) {
    throw new Error(`Sending isn't set up for ${account.name}. Add its SMTP server first.`)
  }
  const to = parseRecipients(mail.to)
  const cc = parseRecipients(mail.cc)
  if (to.length === 0) throw new Error('Add at least one recipient.')

  // Build the message once; the same bytes are sent and saved to Sent.
  const builder = createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
  const built = await builder.sendMail({
    from: senderName ? { name: senderName, address: mail.from } : mail.from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject: mail.subject,
    text: original ? mail.text + quote(original) : mail.text,
    inReplyTo: original?.messageId ?? undefined,
    references: original?.messageId ? [...original.references, original.messageId] : undefined,
    date: new Date()
  })
  const raw = built.message as Buffer

  const transport = createTransport(smtpOptions(account, password))
  try {
    await transport.sendMail({
      envelope: { from: mail.from, to: [...to, ...cc] },
      raw
    })
  } catch (error) {
    throw new Error(smtpError(error), { cause: error })
  } finally {
    transport.close()
  }
  return raw
}

/** Logs in to the SMTP server once to check the settings. */
export async function testSmtp(
  account: Pick<AccountInfo, 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'user'>,
  password: string
): Promise<void> {
  const transport = createTransport({
    ...smtpOptions(account, password),
    connectionTimeout: 15_000
  })
  try {
    await transport.verify()
  } catch (error) {
    throw new Error(`Sending: ${smtpError(error)}`, { cause: error })
  } finally {
    transport.close()
  }
}

function smtpError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; response?: string; message?: string }
  if (e.code === 'EAUTH') return 'The SMTP server rejected the login.'
  if (e.code === 'ENOTFOUND' || e.code === 'EDNS') return 'SMTP server not found.'
  if (e.code === 'ECONNREFUSED') return 'The SMTP server refused the connection. Check the port.'
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION') {
    return 'The SMTP server did not answer. Check the server and port.'
  }
  if (e.code === 'ESOCKET' || e.code === 'ETLS') {
    return 'Secure connection to the SMTP server failed. Check the port and the SSL setting.'
  }
  if (e.code === 'EENVELOPE' && e.response) return `A recipient was refused: ${e.response}`
  return e.response || e.message || String(error)
}
