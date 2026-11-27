import { net } from 'electron'

import type { MailDate } from '../../shared/types'

// EMBER_TODOIST_API only points automated tests at a fake server.
const API = process.env.EMBER_TODOIST_API || 'https://api.todoist.com/api/v1'

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await net.fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers
      }
    })
  } catch (error) {
    throw new Error('Could not reach Todoist.', { cause: error })
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Todoist rejected this token.')
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Todoist error ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return (await response.json()) as T
}

/** Throws a readable message when the token doesn't work. */
export async function verifyTodoistToken(token: string): Promise<void> {
  await call(token, '/projects?limit=1')
}

/** Creates a task in the Todoist inbox for a date from a mail. Returns the task id. */
export async function addTodoistTask(
  token: string,
  date: MailDate,
  mail: { fromName: string; subject: string }
): Promise<string> {
  const due = date.time
    ? // The mail's time is taken as local time on this PC.
      { due_datetime: new Date(`${date.date}T${date.time}:00`).toISOString() }
    : { due_date: date.date }
  const task = await call<{ id: string }>(token, '/tasks', {
    method: 'POST',
    body: JSON.stringify({
      content: date.title,
      description: `From ${mail.fromName}: ${mail.subject}`,
      ...due
    })
  })
  return String(task.id)
}
