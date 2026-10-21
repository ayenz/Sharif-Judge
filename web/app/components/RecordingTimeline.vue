<script setup lang="ts">
const props = defineProps<{
  timeline: RecTimeline
  position: number
}>()
const emit = defineEmits<{ seek: [position: number] }>()

const bar = useTemplateRef<HTMLDivElement>('bar')
const dragging = ref(false)
const hover = ref<number | null>(null)

const total = computed(() => Math.max(1, props.timeline.total))
const pct = (ms: number) => `${Math.min(100, Math.max(0, ms / total.value * 100))}%`

const MARKER_COLOR: Record<RecMarkerType, string> = {
  execute: 'bg-sky-500',
  submit: 'bg-primary',
  save: 'bg-zinc-500',
  paste: 'bg-amber-500',
  away: 'bg-rose-500',
}

// One marker per type per 0.25% of the bar keeps the DOM small on long recordings.
const markers = computed(() => {
  const seen = new Set<string>()
  return props.timeline.markers.filter((m) => {
    const key = `${m.type}:${Math.round(m.g / total.value * 400)}`
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
})

const maxActivity = computed(() => Math.max(1, ...props.timeline.activity.map(b => b.insert + b.remove)))

function posFromEvent(e: PointerEvent): number {
  const rect = bar.value!.getBoundingClientRect()
  const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
  return Math.round(x / rect.width * props.timeline.total)
}

function onDown(e: PointerEvent) {
  if (!bar.value)
    return
  dragging.value = true
  bar.value.setPointerCapture(e.pointerId)
  emit('seek', posFromEvent(e))
}
function onMove(e: PointerEvent) {
  if (!bar.value)
    return
  hover.value = posFromEvent(e)
  if (dragging.value)
    emit('seek', hover.value)
}
function onUp(e: PointerEvent) {
  dragging.value = false
  bar.value?.releasePointerCapture(e.pointerId)
}
function onKey(e: KeyboardEvent) {
  const step = e.shiftKey ? 30_000 : 5_000
  if (e.key === 'ArrowRight')
    emit('seek', Math.min(props.timeline.total, props.position + step))
  else if (e.key === 'ArrowLeft')
    emit('seek', Math.max(0, props.position - step))
  else if (e.key === 'Home')
    emit('seek', 0)
  else if (e.key === 'End')
    emit('seek', props.timeline.total)
  else
    return
  e.preventDefault()
}
</script>

<template>
  <div class="select-none">
    <!-- Edit activity -->
    <div class="flex h-8 gap-px" aria-hidden="true">
      <div
        v-for="(b, i) in timeline.activity"
        :key="i"
        class="flex-1 flex flex-col justify-end"
        :title="`${b.insert} inserts, ${b.remove} removes`"
      >
        <div class="bg-rose-400/70 rounded-t-[1px]" :style="{ height: `${b.remove / maxActivity * 100}%` }" />
        <div class="bg-emerald-500/70" :style="{ height: `${b.insert / maxActivity * 100}%` }" />
      </div>
    </div>

    <div
      ref="bar"
      class="relative h-7 mt-1 cursor-pointer rounded-md bg-elevated ring-1 ring-default touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary"
      role="slider"
      tabindex="0"
      aria-label="Seek"
      :aria-valuemin="0"
      :aria-valuemax="timeline.total"
      :aria-valuenow="position"
      :aria-valuetext="recordingClock(position)"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="hover = null"
      @keydown="onKey"
    >
      <!-- away periods -->
      <div
        v-for="(a, i) in timeline.away"
        :key="`a${i}`"
        class="absolute inset-y-0 bg-rose-500/15"
        :style="{ left: pct(a.from), width: `calc(${pct(a.to - a.from)} + 1px)` }"
      />
      <!-- played part -->
      <div class="absolute inset-y-0 left-0 rounded-l-md bg-primary/25" :style="{ width: pct(position) }" />
      <!-- session boundaries -->
      <div
        v-for="(s, i) in timeline.sessions.slice(1)"
        :key="`s${i}`"
        class="absolute inset-y-0 w-px bg-default border-l border-dashed border-accented"
        :style="{ left: pct(s.offset) }"
      />
      <!-- markers -->
      <div
        v-for="(m, i) in markers"
        :key="`m${i}`"
        class="absolute top-1 bottom-1 w-0.5 rounded-full"
        :class="MARKER_COLOR[m.type]"
        :style="{ left: pct(m.g) }"
        :title="`${m.label} · ${recordingClock(m.g)}`"
      />
      <!-- playhead -->
      <div class="absolute -top-1 -bottom-1 w-0.5 bg-primary shadow" :style="{ left: pct(position) }">
        <div class="absolute -top-1 -left-1.5 size-3.5 rounded-full bg-primary ring-2 ring-default" />
      </div>
      <!-- hover time -->
      <div
        v-if="hover !== null"
        class="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-inverted text-inverted text-[11px] tabular-nums pointer-events-none"
        :style="{ left: pct(hover) }"
      >
        {{ recordingClock(hover) }}
      </div>
    </div>

    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted">
      <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-sky-500" />Run</span>
      <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-primary" />Submit</span>
      <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-zinc-500" />Save</span>
      <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-amber-500" />Large insert</span>
      <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-rose-500" />Left page</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-3 rounded-sm bg-rose-500/30" />Away</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-3 rounded-sm bg-emerald-500/70" />Inserts</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-3 rounded-sm bg-rose-400/70" />Removes</span>
    </div>
  </div>
</template>
