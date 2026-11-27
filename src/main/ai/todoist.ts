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

export interface TodoistTask {
  id: string
  content: string
  description: string
  /** YYYY-MM-DD, or null without a due date. */
  dueDate: string | null
}

/** All open tasks with a due date (up to 1000). */
export async function listDueTasks(token: string): Promise<TodoistTask[]> {
  type Page = {
    results: Array<{
      id: string
      content: string
      description?: string
      due?: { date?: string } | null
    }>
    next_cursor: string | null
  }
  const tasks: TodoistTask[] = []
  let cursor: string | null = null
  for (let page = 0; page < 5; page++) {
    const query = `/tasks?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const result: Page = await call<Page>(token, query)
    for (const task of result.results) {
      const due = task.due?.date?.slice(0, 10) ?? null
      if (due) {
        tasks.push({
          id: String(task.id),
          content: task.content,
          description: task.description ?? '',
          dueDate: due
        })
      }
    }
    cursor = result.next_cursor
    if (!cursor) break
  }
  return tasks
}

const words = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4)
  )

/**
 * An open task that already covers this date: due the same day, and either made by
 * Ember Mail for this mail (its description names the subject) or sharing a real word
 * with the title ("Dentist appointment" and "Dentist Dr. Meyer").
 */
export function findExistingTask(
  tasks: TodoistTask[],
  date: MailDate,
  mail: { subject: string }
): TodoistTask | undefined {
  const titleWords = words(date.title)
  return tasks.find((task) => {
    if (task.dueDate !== date.date) return false
    if (mail.subject && task.description.includes(mail.subject)) return true
    const taskWords = words(`${task.content} ${task.description}`)
    return [...titleWords].some((w) => taskWords.has(w))
  })
}
