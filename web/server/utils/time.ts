// All times in the database are wall-clock strings ("YYYY-MM-DD HH:MM:SS") in the
// timezone configured in settings. To compare them we treat every such string as
// if it were UTC, which keeps differences correct without any DST surprises.

/** Seconds since epoch for a wall-clock string. */
export function toEpoch(value: string | null | undefined): number {
  if (!value)
    return 0
  const t = Date.parse(`${value.replace(' ', 'T')}Z`)
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000)
}

/** Wall-clock string for seconds since epoch (inverse of toEpoch). */
export function fromEpoch(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

/** Current wall-clock time in the given IANA timezone. */
export function wallClockNow(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  }
  catch {
    return fromEpoch(Math.floor(Date.now() / 1000))
  }
}

export async function nowStr(): Promise<string> {
  return wallClockNow(await getSetting('timezone'))
}

export async function nowEpoch(): Promise<number> {
  return toEpoch(await nowStr())
}

/** HH:MM where HH is the total number of hours. */
export function timeHhmm(seconds: number): string {
  const m = Math.floor(seconds / 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
