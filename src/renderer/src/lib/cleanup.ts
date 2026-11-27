import { localDay, mailDateLabel } from '@renderer/lib/format'
import type { MailCategory, MailSummary } from '../../../shared/types'

export interface CleanupSuggestion {
  mail: MailSummary
  /** archive: just archive. todoist: add the dates to Todoist, then archive. */
  action: 'archive' | 'todoist'
  reason: string
  /** For todoist: indexes into mail.analysis.dates to add. */
  dateIndexes: number[]
}

const CATEGORY_LABEL: Record<MailCategory, string> = {
  personal: 'Personal',
  work: 'Work',
  finance: 'Finance',
  shopping: 'Shopping',
  travel: 'Travel',
  event: 'Event',
  newsletter: 'Newsletter',
  notification: 'Notification',
  promotion: 'Promotion',
  spam: 'Spam'
}

/**
 * Only mails Claude has analysed, never urgent or important ones. Unread mail only
 * when it is spam, an ad, a newsletter or has expired; read notifications and other
 * throwaway mail too.
 */
export function suggestCleanup(inbox: MailSummary[], now = new Date()): CleanupSuggestion[] {
  const today = localDay(now)
  const suggestions: CleanupSuggestion[] = []

  for (const mail of inbox) {
    const analysis = mail.analysis
    if (!analysis || mail.folder !== 'inbox') continue

    const pending = analysis.dates
      .map((date, index) => ({ date, index }))
      .filter(({ date }) => date.kind !== 'expiry' && date.date >= today && !date.todoistTaskId)

    if (analysis.category === 'spam') {
      suggestions.push({ mail, action: 'archive', reason: 'Spam', dateIndexes: [] })
      continue
    }
    if (analysis.urgency !== 'none') continue

    if (analysis.expiresOn && analysis.expiresOn < today && pending.length === 0) {
      suggestions.push({
        mail,
        action: 'archive',
        reason: `Expired ${mailDateLabel(analysis.expiresOn, null, now)}`,
        dateIndexes: []
      })
      continue
    }
    // Ads and newsletters can go even unread.
    const bulk = analysis.category === 'promotion' || analysis.category === 'newsletter'
    if (bulk && pending.length === 0) {
      suggestions.push({
        mail,
        action: 'archive',
        reason: CATEGORY_LABEL[analysis.category],
        dateIndexes: []
      })
      continue
    }
    if (mail.unread) continue

    if (pending.length > 0) {
      suggestions.push({
        mail,
        action: 'todoist',
        reason: pending
          .map(({ date }) => `${date.title} · ${mailDateLabel(date.date, date.time, now)}`)
          .join(', '),
        dateIndexes: pending.map(({ index }) => index)
      })
      continue
    }

    const inTodoist = analysis.dates.some(
      (date) => date.kind !== 'expiry' && date.date >= today && date.todoistTaskId
    )
    if (inTodoist) {
      suggestions.push({ mail, action: 'archive', reason: 'Already in Todoist', dateIndexes: [] })
      continue
    }

    if (analysis.disposable || analysis.category === 'notification') {
      suggestions.push({
        mail,
        action: 'archive',
        reason: CATEGORY_LABEL[analysis.category],
        dateIndexes: []
      })
    }
  }
  return suggestions
}
