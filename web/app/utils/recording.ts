// Recording (code replay) model shared by the recordings pages and RecordingPlayer.
//
// File format, written by the capture code on the submit page (legacy shj_submit.js):
//   { "<session start, epoch ms>": { metrics: {...}, events: RecEvent[] }, ... }
// Older files store the events array directly: { "<start>": RecEvent[] }.
// Event times are milliseconds since the session start.

export interface RecEvent {
  time: number
  event: string
  args?: unknown
}

export interface RecSession {
  /** Session start, epoch ms (browser clock of the student). */
  start: number
  events: RecEvent[]
  /** Time of the last event, ms. */
  duration: number
  /** Position of the session on the global timeline, ms. */
  offset: number
  metrics?: Record<string, unknown>
}

export interface RecFlatEvent {
  /** Global timeline position, ms. */
  g: number
  /** Session index. */
  s: number
  e: RecEvent
}

export type RecMarkerType = 'execute' | 'submit' | 'save' | 'paste' | 'away'

export interface RecMarker {
  type: RecMarkerType
  g: number
  label: string
}

export interface RecCounters {
  inserted: number
  removed: number
  execute: number
  inputChange: number
  navIn: number
  navOut: number
}

export interface RecTimeline {
  sessions: RecSession[]
  flat: RecFlatEvent[]
  total: number
  /** Index in `flat` of each session's first event. */
  sessionStartIdx: number[]
  /** Cumulative counters: value at k = after applying the first k flat events. */
  counters: Record<keyof RecCounters, Int32Array>
  markers: RecMarker[]
  /** Periods where the student was away from the page (blur / hidden tab). */
  away: { from: number, to: number }[]
  /** Edit activity histogram over the whole timeline. */
  activity: { insert: number, remove: number }[]
}

/** Gap inserted between sessions on the timeline (legacy confPlayer.durationNext). */
export const RECORDING_SESSION_GAP = 500
/** A single insert at least this long is flagged as a probable paste. */
export const RECORDING_PASTE_CHARS = 30
const ACTIVITY_BINS = 120

export const RECORDING_EVENT_LABEL: Record<string, string> = {
  insert: 'Insert',
  remove: 'Remove',
  cursor_selection: 'Cursor change',
  sel_selection: 'Selection change',
  focus: 'User is focused on the page',
  blur: 'User left the page',
  visibility: 'Tab visibility changed',
  pdf_focus: 'User is reading the PDF',
  pdf_blur: 'User left the PDF viewer',
  input_change: 'Changed input',
  output_change: 'Output changed',
  save: 'User saved',
  submit: 'User submitted',
  execute: 'User ran the program',
}

/** Status message for non-edit events (same meaning as the legacy player). */
export function recordingStatusText(e: RecEvent): string | null {
  switch (e.event) {
    case 'visibility':
      // The legacy player tested `(args, time)`, which is always truthy; use the real flag.
      return e.args ? 'User is back on SharIF Judge' : 'User switched to another tab'
    case 'insert':
    case 'remove':
    case 'cursor_selection':
    case 'sel_selection':
    case 'input_change':
    case 'output_change':
      return null
    default:
      return RECORDING_EVENT_LABEL[e.event] ?? e.event
  }
}

function insertedText(e: RecEvent): string {
  const data = (e.args as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? data.join('\n') : ''
}

function normalizeEvents(value: unknown): RecEvent[] {
  const list = Array.isArray(value) ? value : (value as { events?: unknown } | null)?.events
  if (!Array.isArray(list))
    return []
  return list
    .filter((e): e is RecEvent => !!e && typeof e === 'object' && typeof (e as RecEvent).event === 'string')
    .map(e => ({ ...e, time: Number(e.time) || 0 }))
}

/** Parses a recording file into a playable timeline. */
export function parseRecording(json: unknown): RecTimeline {
  const data = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const sessions: RecSession[] = []
  let offset = 0
  for (const key of Object.keys(data).sort((a, b) => Number(a) - Number(b))) {
    const events = normalizeEvents(data[key])
    // Sessions without events cannot be played (the legacy player crashed on them).
    if (!events.length)
      continue
    const raw = data[key]
    const duration = Math.max(0, events.at(-1)!.time)
    sessions.push({
      start: Number(key),
      events,
      duration,
      offset,
      metrics: !Array.isArray(raw) ? (raw as { metrics?: Record<string, unknown> }).metrics : undefined,
    })
    offset += duration + RECORDING_SESSION_GAP
  }
  const total = sessions.length ? offset - RECORDING_SESSION_GAP : 0

  const flat: RecFlatEvent[] = []
  const sessionStartIdx: number[] = []
  sessions.forEach((session, s) => {
    sessionStartIdx.push(flat.length)
    let last = session.offset
    for (const e of session.events) {
      // Keep global time monotonic so binary search works even on odd files.
      last = Math.max(last, session.offset + e.time)
      flat.push({ g: last, s, e })
    }
  })

  const n = flat.length
  const counters = {
    inserted: new Int32Array(n + 1),
    removed: new Int32Array(n + 1),
    execute: new Int32Array(n + 1),
    inputChange: new Int32Array(n + 1),
    navIn: new Int32Array(n + 1),
    navOut: new Int32Array(n + 1),
  }
  const markers: RecMarker[] = []
  const away: { from: number, to: number }[] = []
  const activity = Array.from({ length: ACTIVITY_BINS }, () => ({ insert: 0, remove: 0 }))
  let awayFrom: number | null = null
  let awaySession = -1

  const c: RecCounters = { inserted: 0, removed: 0, execute: 0, inputChange: 0, navIn: 0, navOut: 0 }
  flat.forEach(({ g, s, e }, i) => {
    if (awayFrom !== null && s !== awaySession) {
      away.push({ from: awayFrom, to: sessions[awaySession]!.offset + sessions[awaySession]!.duration })
      awayFrom = null
    }
    const bin = total > 0 ? Math.min(ACTIVITY_BINS - 1, Math.floor(g / total * ACTIVITY_BINS)) : 0
    // Same metric rules as the capture code (metricHandlers in shj_submit.js).
    switch (e.event) {
      case 'insert': {
        const len = insertedText(e).length
        c.inserted += len
        activity[bin]!.insert++
        if (len >= RECORDING_PASTE_CHARS)
          markers.push({ type: 'paste', g, label: `Large insert (${len} chars)` })
        break
      }
      case 'remove':
        c.removed += insertedText(e).length
        activity[bin]!.remove++
        break
      case 'focus':
        c.navIn++
        break
      case 'blur':
        c.navOut++
        break
      case 'visibility':
        if (e.args)
          c.navIn++
        else
          c.navOut++
        break
      case 'pdf_focus':
        c.navIn--
        c.navOut--
        break
      case 'input_change':
        c.inputChange++
        break
      case 'execute':
        c.execute++
        markers.push({ type: 'execute', g, label: 'Run' })
        break
      case 'submit':
        markers.push({ type: 'submit', g, label: 'Submit' })
        break
      case 'save':
        markers.push({ type: 'save', g, label: 'Save' })
        break
    }
    // Away from the page: blur / hidden tab until focus / visible again / PDF viewer focus.
    const leaves = e.event === 'blur' || (e.event === 'visibility' && !e.args)
    const returns = e.event === 'focus' || e.event === 'pdf_focus' || (e.event === 'visibility' && e.args)
    if (leaves && awayFrom === null) {
      awayFrom = g
      awaySession = s
      markers.push({ type: 'away', g, label: e.event === 'blur' ? 'Left the page' : 'Switched tab' })
    }
    else if (returns && awayFrom !== null) {
      away.push({ from: awayFrom, to: g })
      awayFrom = null
    }
    counters.inserted[i + 1] = c.inserted
    counters.removed[i + 1] = c.removed
    counters.execute[i + 1] = c.execute
    counters.inputChange[i + 1] = c.inputChange
    counters.navIn[i + 1] = c.navIn
    counters.navOut[i + 1] = c.navOut
  })
  if (awayFrom !== null)
    away.push({ from: awayFrom, to: sessions[awaySession]!.offset + sessions[awaySession]!.duration })

  return { sessions, flat, total, sessionStartIdx, counters, markers, away, activity }
}

/** Number of flat events with g <= pos. */
export function recordingEventsUntil(t: RecTimeline, pos: number): number {
  let lo = 0
  let hi = t.flat.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (t.flat[mid]!.g <= pos)
      lo = mid + 1
    else
      hi = mid
  }
  return lo
}

/** Index of the session shown at a timeline position. */
export function recordingSessionAt(t: RecTimeline, pos: number): number {
  let lo = 0
  let hi = t.sessions.length - 1
  let found = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t.sessions[mid]!.offset <= pos) {
      found = mid
      lo = mid + 1
    }
    else {
      hi = mid - 1
    }
  }
  return found
}

export function recordingCountersAt(t: RecTimeline, k: number): RecCounters {
  return {
    inserted: t.counters.inserted[k] ?? 0,
    removed: t.counters.removed[k] ?? 0,
    execute: t.counters.execute[k] ?? 0,
    inputChange: t.counters.inputChange[k] ?? 0,
    navIn: t.counters.navIn[k] ?? 0,
    navOut: t.counters.navOut[k] ?? 0,
  }
}

/** HH:MM:SS from milliseconds (legacy format_duration). */
export function recordingDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

/** mm:ss or h:mm:ss for the player clock. */
export function recordingClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function recordingCct(value: number | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '—'
}

/** Ace mode for a submission file type. */
export function recordingAceMode(fileType?: string | null): 'c_cpp' | 'python' | 'java' | 'javascript' | 'golang' {
  switch (fileType) {
    case 'js':
      return 'javascript'
    case 'go':
      return 'golang'
    case 'py2':
    case 'py3':
      return 'python'
    case 'java':
      return 'java'
    default:
      return 'c_cpp'
  }
}
