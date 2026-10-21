import type { Ace } from 'ace-builds'
import { diffChars } from 'diff'

// Port of the recording part of the legacy assets/js/shj_submit.js. The JSON it
// produces must stay compatible with recordings made by the legacy app:
//   { [startTime]: { metrics, events: [{ time, event, args }] }, ... }

interface Metrics {
  inserted: number
  removed: number
  total_input_change: number
  total_execute: number
  total_nav_in: number
  total_nav_out: number
  max_inserted: number
  max_removed: number
}

export interface CalcMetrics {
  origin: Metrics
  duration: number
  cct: { score: number }
  debugging: { input_change: number, execute: number }
  navigation: { total_in: number, total_out: number }
  copyPaste: { max_inserted: number, max_removed: number }
}

interface RecordedEvent { time: number, event: string, args?: unknown }

const emptyMetrics = (): Metrics => ({
  inserted: 0,
  removed: 0,
  total_input_change: 0,
  total_execute: 0,
  total_nav_in: 0,
  total_nav_out: 0,
  max_inserted: -1,
  max_removed: -1,
})

export class EditorRecorder {
  events: RecordedEvent[] = []
  startTime = -1
  endTime = -1
  metrics = emptyMetrics()
  /** Recording sessions loaded from the server (previous saves). */
  previous: Record<string, unknown> = {}
  /** Editor content when it was loaded; the code churn is measured against it. */
  baseText = ''

  private cleanups: (() => void)[] = []
  private pdfFocused = false

  constructor(private editor: Ace.Editor, private ace: { Range: { comparePoints: (a: Ace.Point, b: Ace.Point) => number } }, private pdfFrame?: () => HTMLIFrameElement | null | undefined) {}

  start() {
    this.stop()
    this.events = []
    this.startTime = Date.now()
    this.endTime = -1
    this.metrics = emptyMetrics()

    const onChange = (delta: Ace.Delta) => {
      const payload = { data: delta.lines, start: delta.start, end: delta.end }
      this.record(delta.action, payload)
      const total = delta.lines.join('\n').length
      if (delta.action === 'insert') {
        this.metrics.inserted += total
        this.metrics.max_inserted = Math.max(total, this.metrics.max_inserted)
      }
      else {
        this.metrics.removed += total
        this.metrics.max_removed = Math.max(total, this.metrics.max_removed)
      }
    }
    const onCursor = () => this.record('cursor_selection', this.selection())
    const onSelection = () => this.record('sel_selection', this.selection())
    const session = this.editor.session
    session.on('change', onChange)
    session.selection.on('changeCursor', onCursor)
    session.selection.on('changeSelection', onSelection)
    this.cleanups.push(() => {
      session.off('change', onChange)
      session.selection.off('changeCursor', onCursor)
      session.selection.off('changeSelection', onSelection)
    })

    // Leaving and returning to the page. Clicking into the PDF viewer also blurs the
    // window; the legacy app compensated with pdf_focus (nav in/out minus one).
    const onBlur = () => {
      this.record('blur')
      this.metrics.total_nav_out++
      setTimeout(() => {
        const frame = this.pdfFrame?.()
        if (frame && document.activeElement === frame) {
          this.pdfFocused = true
          this.record('pdf_focus')
          this.metrics.total_nav_in--
          this.metrics.total_nav_out--
        }
      })
    }
    const onFocus = () => {
      if (this.pdfFocused) {
        this.pdfFocused = false
        this.record('pdf_blur')
      }
      this.record('focus')
      this.metrics.total_nav_in++
    }
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible'
      this.record('visibility', visible)
      if (visible)
        this.metrics.total_nav_in++
      else
        this.metrics.total_nav_out++
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    this.cleanups.push(() => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  }

  stop() {
    this.cleanups.forEach(fn => fn())
    this.cleanups = []
  }

  /** Call after loading saved code: the load itself must not count as typing. */
  resetMetrics(baseText: string) {
    this.metrics = emptyMetrics()
    this.baseText = baseText
  }

  inputChanged(value: string) {
    this.record('input_change', value)
    this.metrics.total_input_change++
  }

  outputChanged(value: string) {
    this.record('output_change', value)
  }

  action(kind: 'save' | 'submit' | 'execute') {
    const time = this.now()
    this.events.push({ time, event: kind, args: undefined })
    if (kind === 'execute')
      this.metrics.total_execute++
    this.endTime = time
  }

  stringify(): string {
    return JSON.stringify({
      ...this.previous,
      [this.startTime]: { metrics: this.calcMetrics(), events: this.events },
    })
  }

  /**
   * Aggregated metrics sent with every save. The legacy code meant to add the
   * previous session's totals but its check never matched, so only the current
   * session counts; we keep that so numbers stay comparable.
   */
  calcMetrics(): CalcMetrics {
    const m = this.metrics
    const text = this.editor.getValue()
    const changed = diffChars(this.baseText, text).reduce((sum, part) => (part.added || part.removed) ? sum + (part.count ?? part.value.length) : sum, 0)
    const churn = m.inserted + m.removed
    return {
      origin: { ...m },
      duration: this.endTime,
      // The legacy code divided by zero when nothing changed; report 0 instead.
      cct: { score: changed > 0 ? churn / changed : 0 },
      debugging: { input_change: m.total_input_change, execute: m.total_execute },
      navigation: { total_in: m.total_nav_in, total_out: m.total_nav_out },
      copyPaste: { max_inserted: m.max_inserted, max_removed: m.max_removed },
    }
  }

  private now() {
    return Date.now() - this.startTime
  }

  private record(event: string, args?: unknown) {
    this.events.push({ time: this.now(), event, args })
  }

  /** Same shape as the legacy getSelection(): [row, col] or [r1, c1, r2, c2], or a list of them. */
  private selection() {
    const ms = (this.editor as unknown as { multiSelect?: { toJSON: () => unknown } }).multiSelect
    const data = (ms ? ms.toJSON() : this.editor.selection.toJSON()) as Array<{ start: Ace.Point, end: Ace.Point, isBackwards: boolean }> | { start: Ace.Point, end: Ace.Point, isBackwards: boolean }
    const list = Array.isArray(data) ? data : [data]
    const out = list.map((x) => {
      const a = x.isBackwards ? x.end : x.start
      const c = x.isBackwards ? x.start : x.end
      return this.ace.Range.comparePoints(a, c) ? [a.row, a.column, c.row, c.column] : [a.row, a.column]
    })
    return out.length > 1 ? out : out[0]
  }
}
