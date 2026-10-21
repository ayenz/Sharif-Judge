const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const dateOnly = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

/** Formats a judge wall-clock string ("YYYY-MM-DD HH:MM:SS") for display. */
export function formatDateTime(value?: string | null): string {
  if (!value)
    return '—'
  const ms = wallClockToMs(value)
  return Number.isNaN(ms) ? value : dateTime.format(ms)
}

export function formatDate(value?: string | null): string {
  if (!value)
    return '—'
  const ms = wallClockToMs(value)
  return Number.isNaN(ms) ? value : dateOnly.format(ms)
}

/** HH:MM where HH is total hours (same as the legacy time_hhmm). */
export function hhmm(seconds: number): string {
  const m = Math.floor(seconds / 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "2d 4h 10m" style duration. */
export function humanDuration(seconds: number): string {
  seconds = Math.max(0, Math.floor(seconds))
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d)
    return `${d}d ${h}h ${m}m`
  if (h)
    return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

/** Extracts a user-facing message (and field errors) from a $fetch error. */
export function apiError(error: unknown): { message: string, fields: Record<string, string> } {
  const e = error as { data?: { statusMessage?: string, message?: string, data?: { errors?: Record<string, string> } }, statusMessage?: string, message?: string }
  const fields = e?.data?.data?.errors ?? {}
  const message = fields._ ?? Object.values(fields)[0] ?? e?.data?.statusMessage ?? e?.data?.message ?? e?.statusMessage ?? 'Something went wrong.'
  return { message, fields }
}
