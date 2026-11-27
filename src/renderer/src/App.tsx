import { useState } from 'react'

import { demoMails } from '@renderer/demo-data'
import { InboxScreen } from '@renderer/screens/InboxScreen'
import { MailScreen } from '@renderer/screens/MailScreen'

function App(): React.JSX.Element {
  const [mails, setMails] = useState(demoMails)
  const [openId, setOpenId] = useState<string | null>(null)
  const openMail = mails.find((mail) => mail.id === openId)

  const open = (id: string): void => {
    setMails((current) => current.map((m) => (m.id === id ? { ...m, unread: false } : m)))
    setOpenId(id)
  }

  const archive = (id: string): void => {
    setMails((current) => current.filter((m) => m.id !== id))
    setOpenId(null)
  }

  if (openMail) {
    return <MailScreen mail={openMail} onBack={() => setOpenId(null)} onArchive={archive} />
  }
  return <InboxScreen mails={mails} onOpen={open} />
}

export default App
