<script setup lang="ts">
// Replays a code recording (port of the legacy shj_recording.js player).
// Ace is imported dynamically here, so it only ends up in this component's chunk.
import type { Ace } from 'ace-builds'

const props = defineProps<{
  /** URL of the recording JSON. */
  src: string
  /** Submission file type (c, cpp, py3, java, ...) for syntax highlighting. */
  language?: string | null
}>()

type AceModule = typeof import('ace-builds')

const editorEl = useTemplateRef<HTMLDivElement>('editorEl')
const loading = ref(true)
const loadError = ref('')
const timeline = shallowRef<RecTimeline | null>(null)
const position = ref(0)
const playing = ref(false)
const speed = ref(1)
const skipIdle = ref(true)
const inputText = ref('')
const outputText = ref('')
const status = ref<{ text: string, g: number } | null>(null)
const applied = ref(0)
const sessionIdx = ref(0)

const SPEEDS = [0.5, 1, 2, 4, 8, 16, 32]
const speedItems = SPEEDS.map(s => ({ label: `${s}×`, value: s }))
/** While playing with "skip idle", gaps longer than this are jumped over. */
const IDLE_MS = 2000

let ace: AceModule | undefined
let editor: Ace.Editor | undefined
let raf = 0
let lastFrame = 0
let disposed = false

const colorMode = useColorMode()
const theme = computed(() => (colorMode.value === 'dark' ? 'ace/theme/tomorrow_night' : 'ace/theme/tomorrow'))
watch(theme, t => editor?.setTheme(t))

async function loadAce(): Promise<AceModule> {
  const mod = await import('ace-builds')
  const a = ((mod as unknown as { default?: AceModule }).default ?? mod) as AceModule
  // Mode/theme files register themselves on the global `ace`, so load them after ace.
  const mode = recordingAceMode(props.language)
  const modes = {
    python: () => import('ace-builds/src-noconflict/mode-python'),
    java: () => import('ace-builds/src-noconflict/mode-java'),
    javascript: () => import('ace-builds/src-noconflict/mode-javascript'),
    golang: () => import('ace-builds/src-noconflict/mode-golang'),
    c_cpp: () => import('ace-builds/src-noconflict/mode-c_cpp'),
  }
  await Promise.all([
    modes[mode](),
    import('ace-builds/src-noconflict/theme-tomorrow'),
    import('ace-builds/src-noconflict/theme-tomorrow_night'),
  ])
  return a
}

async function init() {
  loading.value = true
  loadError.value = ''
  try {
    const [a, json] = await Promise.all([
      ace ? Promise.resolve(ace) : loadAce(),
      $fetch<unknown>(props.src, { responseType: 'json' }),
    ])
    if (disposed)
      return
    ace = a
    const parsed = parseRecording(typeof json === 'string' ? JSON.parse(json) : json)
    timeline.value = parsed
    if (!editor && editorEl.value) {
      editor = a.edit(editorEl.value, {
        readOnly: true,
        showPrintMargin: false,
        highlightActiveLine: true,
        fontSize: 13,
        tabSize: 4,
        useWorker: false,
        mode: `ace/mode/${recordingAceMode(props.language)}`,
        theme: theme.value,
      })
    }
    resetView()
    applied.value = 0
    sessionIdx.value = 0
    position.value = 0
    sync(0)
  }
  catch (e) {
    loadError.value = apiError(e).message === 'Something went wrong.' ? 'Cannot load the recording.' : apiError(e).message
  }
  finally {
    loading.value = false
  }
}

function resetView() {
  editor?.session.setValue('')
  inputText.value = ''
  outputText.value = ''
  status.value = null
}

function setSelection(args: unknown) {
  if (!editor || !ace || !Array.isArray(args))
    return
  // Multi-cursor selections are stored as an array of ranges; show the first one.
  const x = (Array.isArray(args[0]) ? args[0] : args) as number[]
  const start = { row: Number(x[0]) || 0, column: Number(x[1]) || 0 }
  const end = x.length >= 4 ? { row: Number(x[2]) || 0, column: Number(x[3]) || 0 } : start
  const backwards = ace.Range.comparePoints(start, end) > 0
  editor.selection.setSelectionRange(
    backwards ? new ace.Range(end.row, end.column, start.row, start.column) : new ace.Range(start.row, start.column, end.row, end.column),
    backwards,
  )
}

function applyEvent(f: RecFlatEvent) {
  const e = f.e
  const doc = editor?.session.getDocument()
  try {
    switch (e.event) {
      case 'insert': {
        const args = e.args as { start: Ace.Point, data: string[] }
        doc?.insert(args.start, (args.data ?? []).join('\n'))
        break
      }
      case 'remove': {
        const args = e.args as { start: Ace.Point, end: Ace.Point }
        if (doc && ace)
          doc.remove(new ace.Range(args.start.row, args.start.column, args.end.row, args.end.column))
        break
      }
      case 'cursor_selection':
      case 'sel_selection':
        setSelection(e.args)
        break
      case 'input_change':
        inputText.value = String(e.args ?? '')
        break
      case 'output_change':
        outputText.value = String(e.args ?? '')
        break
      default: {
        const text = recordingStatusText(e)
        if (text)
          status.value = { text, g: f.g }
      }
    }
  }
  catch (error) {
    console.warn('[recording] cannot apply event', e, error)
  }
}

const EDIT_EVENTS = new Set(['insert', 'remove'])

/** Brings the editor to the state at `pos` (legacy setState), incrementally when moving forward. */
function sync(pos: number) {
  const t = timeline.value
  if (!t || !t.sessions.length)
    return
  const s = recordingSessionAt(t, pos)
  const target = recordingEventsUntil(t, pos)
  let from = applied.value
  if (s !== sessionIdx.value || target < from || from < t.sessionStartIdx[s]!) {
    // Each session starts from an empty editor, like the legacy player.
    resetView()
    sessionIdx.value = s
    from = t.sessionStartIdx[s]!
  }
  const count = target - from
  if (count > 50) {
    // Bulk: apply edits in order, but only the last event of every other kind.
    const lastOfKind = new Map<string, RecFlatEvent>()
    for (let i = from; i < target; i++) {
      const f = t.flat[i]!
      if (EDIT_EVENTS.has(f.e.event))
        applyEvent(f)
      else
        lastOfKind.set(f.e.event, f)
    }
    for (const f of [...lastOfKind.values()].sort((a, b) => a.g - b.g))
      applyEvent(f)
  }
  else {
    for (let i = from; i < target; i++)
      applyEvent(t.flat[i]!)
  }
  applied.value = Math.max(target, from)
  if (count > 0)
    editor?.renderer.scrollCursorIntoView(undefined, 0.5)
}

function seek(pos: number) {
  const t = timeline.value
  if (!t)
    return
  position.value = Math.min(Math.max(0, pos), t.total)
  sync(position.value)
}

function frame(now: number) {
  const t = timeline.value
  if (!t || !playing.value)
    return
  const dt = now - lastFrame
  lastFrame = now
  let next = position.value + dt * speed.value
  if (skipIdle.value) {
    const upcoming = t.flat[recordingEventsUntil(t, position.value)]
    if (upcoming && upcoming.g - position.value > IDLE_MS)
      next = Math.max(next, upcoming.g - 250)
  }
  if (next >= t.total) {
    seek(t.total)
    pause()
    return
  }
  seek(next)
  raf = requestAnimationFrame(frame)
}

function play() {
  const t = timeline.value
  if (!t || !t.total)
    return
  if (position.value >= t.total)
    seek(0)
  playing.value = true
  lastFrame = performance.now()
  raf = requestAnimationFrame(frame)
}

function pause() {
  playing.value = false
  cancelAnimationFrame(raf)
}

function toggle() {
  if (playing.value)
    pause()
  else
    play()
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('textarea, input, [role="slider"], button, [role="combobox"]'))
    return
  if (e.key === ' ' || e.key === 'k') {
    e.preventDefault()
    toggle()
  }
}

onMounted(init)
watch(() => props.src, () => {
  pause()
  applied.value = 0
  sessionIdx.value = 0
  init()
})
onBeforeUnmount(() => {
  disposed = true
  pause()
  editor?.destroy()
  editor = undefined
})

const counters = computed(() => (timeline.value ? recordingCountersAt(timeline.value, applied.value) : null))
const session = computed(() => timeline.value?.sessions[sessionIdx.value])
const isAway = computed(() => {
  const t = timeline.value
  return !!t?.away.some(a => a.from <= position.value && position.value < a.to)
})
const keyEvents = computed(() => timeline.value?.markers.slice(0, 500) ?? [])
const MARKER_ICON: Record<RecMarkerType, string> = {
  execute: 'i-lucide-play',
  submit: 'i-lucide-send',
  save: 'i-lucide-save',
  paste: 'i-lucide-clipboard-paste',
  away: 'i-lucide-log-out',
}
const sessionMetric = computed(() => {
  const m = session.value?.metrics as { cct?: { score?: number }, duration?: number } | undefined
  return m ? { cct: m.cct?.score, duration: m.duration } : null
})

function sessionTime(ms: number) {
  return new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })
}
</script>

<template>
  <div class="space-y-4" @keydown="onKey">
    <UAlert v-if="loadError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="loadError" />

    <div class="grid gap-4 xl:grid-cols-[1fr_18rem]">
      <!-- Editor + I/O -->
      <div class="space-y-3 min-w-0">
        <div class="relative rounded-lg overflow-hidden ring-1 ring-default">
          <div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-elevated text-xs text-muted border-b border-default">
            <span class="inline-flex items-center gap-1.5">
              <UIcon name="i-lucide-code" class="size-3.5" />
              Code
              <template v-if="timeline && timeline.sessions.length > 1">· session {{ sessionIdx + 1 }} / {{ timeline.sessions.length }}</template>
            </span>
            <span v-if="status" class="inline-flex items-center gap-1.5 truncate">
              <span class="size-1.5 rounded-full" :class="isAway ? 'bg-rose-500' : 'bg-emerald-500'" />
              {{ status.text }} <span class="text-dimmed">· {{ recordingClock(status.g) }}</span>
            </span>
          </div>
          <div ref="editorEl" class="rec-editor h-[50vh] min-h-72 w-full" />
          <div v-if="loading" class="absolute inset-0 grid place-items-center bg-default/70">
            <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
          </div>
          <div
            v-if="isAway && !loading"
            class="absolute top-10 right-3 rounded-md bg-rose-500/90 text-white text-xs px-2 py-1 shadow"
          >
            Student is away from the page
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="text-xs font-medium text-muted mb-1">
              Input
            </p>
            <UTextarea :model-value="inputText" readonly :rows="4" autoresize :maxrows="10" class="w-full font-mono" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted mb-1">
              Output
            </p>
            <UTextarea :model-value="outputText" readonly :rows="4" autoresize :maxrows="10" class="w-full font-mono" />
          </div>
        </div>
      </div>

      <!-- Live metrics -->
      <div class="space-y-3">
        <UCard :ui="{ body: 'p-3 sm:p-3' }">
          <p class="text-xs font-medium text-muted mb-2">
            Up to this moment
          </p>
          <dl v-if="counters" class="grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-md bg-emerald-500/10 px-2 py-1.5">
              <dt class="text-[11px] text-muted">
                Inserted
              </dt>
              <dd class="font-semibold tabular-nums">
                {{ counters.inserted }}
              </dd>
            </div>
            <div class="rounded-md bg-rose-500/10 px-2 py-1.5">
              <dt class="text-[11px] text-muted">
                Removed
              </dt>
              <dd class="font-semibold tabular-nums">
                {{ counters.removed }}
              </dd>
            </div>
            <div class="rounded-md bg-sky-500/10 px-2 py-1.5">
              <dt class="text-[11px] text-muted">
                Runs
              </dt>
              <dd class="font-semibold tabular-nums">
                {{ counters.execute }}
              </dd>
            </div>
            <div class="rounded-md bg-violet-500/10 px-2 py-1.5">
              <dt class="text-[11px] text-muted">
                Input changes
              </dt>
              <dd class="font-semibold tabular-nums">
                {{ counters.inputChange }}
              </dd>
            </div>
            <div class="col-span-2 rounded-md bg-elevated px-2 py-1.5">
              <dt class="text-[11px] text-muted">
                Navigation in / out
              </dt>
              <dd class="font-semibold tabular-nums">
                {{ counters.navIn }} / {{ counters.navOut }}
              </dd>
            </div>
          </dl>
          <div v-if="sessionMetric" class="mt-3 pt-3 border-t border-default text-xs text-muted space-y-1">
            <p class="font-medium">
              Saved with this session
            </p>
            <p v-if="sessionMetric.cct !== undefined">
              CCT: <span class="text-highlighted tabular-nums">{{ recordingCct(sessionMetric.cct) }}</span>
            </p>
            <p v-if="sessionMetric.duration !== undefined">
              Active duration: <span class="text-highlighted tabular-nums">{{ recordingDuration(sessionMetric.duration) }}</span>
            </p>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <p class="text-xs font-medium text-muted px-3 pt-3 pb-2">
            Key events
          </p>
          <ul v-if="keyEvents.length" class="max-h-64 overflow-y-auto text-xs divide-y divide-default">
            <li v-for="(m, i) in keyEvents" :key="i">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-elevated"
                :class="m.g <= position ? '' : 'opacity-60'"
                @click="seek(m.g)"
              >
                <UIcon :name="MARKER_ICON[m.type]" class="size-3.5 shrink-0 text-muted" />
                <span class="flex-1 truncate">{{ m.label }}</span>
                <span class="tabular-nums text-muted">{{ recordingClock(m.g) }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="px-3 pb-3 text-xs text-muted">
            No runs, submits or focus changes recorded.
          </p>
        </UCard>
      </div>
    </div>

    <!-- Transport -->
    <UCard v-if="timeline" :ui="{ body: 'p-3 sm:p-4' }">
      <div class="flex flex-wrap items-center gap-2 mb-6">
        <UButton
          :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          :aria-label="playing ? 'Pause' : 'Play'"
          :disabled="!timeline.total"
          @click="toggle"
        >
          {{ playing ? 'Pause' : 'Play' }}
        </UButton>
        <UButton icon="i-lucide-skip-back" color="neutral" variant="ghost" aria-label="Back 10 seconds" @click="seek(position - 10_000)" />
        <UButton icon="i-lucide-skip-forward" color="neutral" variant="ghost" aria-label="Forward 10 seconds" @click="seek(position + 10_000)" />
        <span class="text-sm tabular-nums text-muted">
          {{ recordingClock(position) }} / {{ recordingClock(timeline.total) }}
        </span>
        <div class="ms-auto flex items-center gap-3">
          <USwitch v-model="skipIdle" label="Skip idle" size="sm" />
          <USelect v-model="speed" :items="speedItems" size="sm" class="w-20" aria-label="Speed" />
        </div>
      </div>
      <RecordingTimeline :timeline="timeline" :position="position" @seek="seek" />
    </UCard>

    <!-- Sessions -->
    <UCard v-if="timeline && timeline.sessions.length" :ui="{ body: 'p-0 sm:p-0' }">
      <p class="text-xs font-medium text-muted px-3 pt-3 pb-2">
        Sessions in this recording
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm whitespace-nowrap">
          <thead class="text-left text-xs text-muted">
            <tr>
              <th class="px-3 py-1.5">
                #
              </th>
              <th class="px-3 py-1.5">
                Start
              </th>
              <th class="px-3 py-1.5">
                End
              </th>
              <th class="px-3 py-1.5 text-right">
                Length
              </th>
              <th class="px-3 py-1.5 text-right">
                Events
              </th>
              <th class="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="(s, i) in timeline.sessions" :key="s.start" :class="i === sessionIdx ? 'bg-primary/10' : ''">
              <td class="px-3 py-1.5 tabular-nums">
                {{ i + 1 }}
              </td>
              <td class="px-3 py-1.5">
                {{ sessionTime(s.start) }}
              </td>
              <td class="px-3 py-1.5">
                {{ sessionTime(s.start + s.duration) }}
              </td>
              <td class="px-3 py-1.5 text-right tabular-nums">
                {{ recordingClock(s.duration) }}
              </td>
              <td class="px-3 py-1.5 text-right tabular-nums">
                {{ s.events.length }}
              </td>
              <td class="px-3 py-1.5 text-right">
                <UButton size="xs" variant="soft" icon="i-lucide-corner-down-right" @click="pause(); seek(s.offset)">
                  Go
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="px-3 py-2 text-[11px] text-muted border-t border-default">
        Times are shown in your browser's timezone, as recorded by the student's browser.
      </p>
    </UCard>
  </div>
</template>

<style scoped>
/* Show the student's cursor even though the replay editor never has focus. */
.rec-editor :deep(.ace_hidden-cursors .ace_cursor) {
  opacity: 1;
}
</style>
