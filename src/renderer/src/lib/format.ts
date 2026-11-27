const AVATAR_COLORS = [
  'bg-orange-700',
  'bg-teal-700',
  'bg-indigo-600',
  'bg-fuchsia-700',
  'bg-green-700',
  'bg-rose-700'
]

const ACCOUNT_DOTS = ['bg-account-1', 'bg-account-2', 'bg-account-3']

export function accountDot(colorIndex: number): string {
  return ACCOUNT_DOTS[colorIndex % ACCOUNT_DOTS.length]
}

export function initials(name: string): string {
  const letters = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
  return (letters.slice(0, 2).join('') || '?').toUpperCase()
}

export function avatarColor(name: string): string {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Today", "Yesterday" or "Earlier", for grouping the list. */
export function dayGroup(iso: string, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return 'Earlier'
}

/** "09:41" today, "Thu" this week, "12 Nov" this year, else "12 Nov 2025". */
export function shortTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days <= 0) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
