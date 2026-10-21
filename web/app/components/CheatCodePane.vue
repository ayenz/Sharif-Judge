<script setup lang="ts">
// Light code view with line numbers and highlighted match ranges (no Ace).
const props = defineProps<{
  code: string
  /** 1-based inclusive line ranges, one per match (the index picks the color). */
  ranges: { start: number, end: number }[]
  active: number | null
  pulse: number
}>()
const emit = defineEmits<{ select: [index: number] }>()

const scroller = useTemplateRef<HTMLDivElement>('scroller')

const lines = computed(() => {
  const list = props.code.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  const owner: (number | null)[] = Array.from({ length: list.length }, () => null)
  props.ranges.forEach((r, i) => {
    for (let l = Math.max(1, r.start); l <= Math.min(list.length, r.end); l++)
      owner[l - 1] ??= i
  })
  return list.map((text, i) => {
    const m = owner[i] ?? null
    return { n: i + 1, text, match: m, first: m !== null && props.ranges[m]!.start === i + 1 }
  })
})

/** Scrolls this pane so the given line sits near the top third. */
function scrollToLine(line: number) {
  const box = scroller.value
  const el = box?.querySelector<HTMLElement>(`[data-line="${line}"]`)
  if (!box || !el)
    return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 3), behavior: reduced ? 'auto' : 'smooth' })
}
defineExpose({ scrollToLine })
</script>

<template>
  <div ref="scroller" class="relative max-h-[70vh] overflow-auto rounded-b-lg bg-default font-mono text-[12.5px] leading-5">
    <div v-if="!code" class="p-6 text-center text-sm text-muted font-sans">
      The code file could not be found.
    </div>
    <div v-else class="w-max min-w-full py-1">
      <div
        v-for="l in lines"
        :key="`${l.n}-${l.match === active ? pulse : 0}`"
        :data-line="l.n"
        class="code-line flex"
        :class="{
          'is-match cursor-pointer': l.match !== null,
          'is-first': l.first,
          'is-active': l.match !== null && l.match === active,
        }"
        :style="l.match !== null ? { '--m': cheatMatchColor(l.match) } : undefined"
        @click="l.match !== null && emit('select', l.match)"
      >
        <span class="sticky left-0 z-[1] w-11 shrink-0 select-none pe-3 text-right text-dimmed bg-default gutter">{{ l.n }}</span>
        <span class="whitespace-pre pe-4 text-default">{{ l.text || ' ' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-line { border-left: 3px solid transparent; }
.code-line.is-match {
  background: color-mix(in oklch, var(--m) 22%, transparent);
  border-left-color: color-mix(in oklch, var(--m) 70%, transparent);
}
.code-line.is-match .gutter { background: color-mix(in oklch, var(--m) 22%, var(--ui-bg)); }
.code-line.is-match:hover { background: color-mix(in oklch, var(--m) 32%, transparent); }
.code-line.is-first { box-shadow: inset 0 1px 0 color-mix(in oklch, var(--m) 60%, transparent); }
.code-line.is-active {
  background: color-mix(in oklch, var(--m) 38%, transparent);
  border-left-color: var(--m);
  animation: match-pulse 1.1s var(--ease-out-soft) 1;
}
.code-line.is-active .gutter { background: color-mix(in oklch, var(--m) 38%, var(--ui-bg)); color: var(--ui-text-highlighted); }
@keyframes match-pulse {
  0% { background: color-mix(in oklch, var(--m) 22%, transparent); }
  35% { background: color-mix(in oklch, var(--m) 65%, transparent); }
  100% { background: color-mix(in oklch, var(--m) 38%, transparent); }
}
</style>
