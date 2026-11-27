// Placeholder mails so the two screens can be tried before real IMAP accounts
// exist. Replaced by real data in step 2.
export interface MailSummary {
  id: string
  from: string
  account: string
  subject: string
  preview: string
  date: string
  unread: boolean
  body: string
}

export const demoMails: MailSummary[] = [
  {
    id: '1',
    from: 'Ember Mail',
    account: 'demo',
    subject: 'Welcome to Ember Mail',
    preview: 'This is placeholder mail. Real accounts arrive in the next step.',
    date: '01:30',
    unread: true,
    body: 'This is placeholder mail so you can try the layout.\n\nOpen a mail to read it full-size, then archive it or go back to the inbox. Real IMAP accounts arrive in the next step.'
  },
  {
    id: '2',
    from: 'Ember Mail',
    account: 'demo',
    subject: 'Inbox Zero, the Ember way',
    preview: 'Read it, deal with it, archive it. Nothing is ever deleted.',
    date: 'Yesterday',
    unread: false,
    body: 'Read it, deal with it, archive it.\n\nArchiving moves the mail to the account’s Archive folder on the server, so Spark on your phone sees the same thing.'
  }
]
