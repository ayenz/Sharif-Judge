<script setup lang="ts">
const { me } = useMe()
const { data, status, refresh } = useFetch('/api/scoreboard', { key: 'scoreboard' })

// Auto-refresh every 30 s while the tab is visible; refresh right away when it becomes visible again.
let timer: ReturnType<typeof setInterval> | undefined
const lastUpdate = ref<Date | null>(null)
watch(data, () => (lastUpdate.value = new Date()))

function onVisibility() {
  if (document.visibilityState === 'visible')
    refresh()
}
onMounted(() => {
  lastUpdate.value = new Date()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible')
      refresh()
  }, 30_000)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})

const board = computed(() => data.value?.scoreboard ?? null)
const updatedLabel = computed(() => lastUpdate.value
  ? lastUpdate.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : '')

function rankClass(rank: number) {
  if (rank === 1)
    return 'bg-amber-400/20 text-amber-600 dark:text-amber-300 ring-amber-400/50'
  if (rank === 2)
    return 'bg-slate-400/20 text-slate-600 dark:text-slate-300 ring-slate-400/50'
  if (rank === 3)
    return 'bg-orange-400/20 text-orange-700 dark:text-orange-300 ring-orange-400/50'
  return 'text-muted ring-transparent'
}

function cellClass(score: number, max: number) {
  if (max > 0 && score >= max)
    return 'text-success font-semibold'
  if (score > 0)
    return 'text-highlighted'
  return 'text-error'
}
</script>

<template>
  <AppPage title="Scoreboard" icon="i-lucide-trophy" wide>
    <div v-if="!data && status === 'pending'" class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-10 w-full" />
    </div>

    <UAlert
      v-else-if="data?.state === 'none'"
      icon="i-lucide-folder-x"
      color="neutral"
      variant="subtle"
      title="No assignment is selected."
      description="Pick an assignment from the selector at the top."
    />

    <UAlert
      v-else-if="data?.state === 'disabled'"
      icon="i-lucide-eye-off"
      color="neutral"
      variant="subtle"
      title="Scoreboard is disabled."
    />

    <template v-else-if="board && data">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p class="text-sm text-muted">
          Scoreboard of <span dir="auto" class="font-medium text-highlighted">{{ data.assignment.name }}</span>
          · {{ board.rows.length }} {{ board.rows.length === 1 ? 'participant' : 'participants' }}
        </p>
        <div class="flex items-center gap-2 text-xs text-muted">
          <span v-if="updatedLabel">Updated {{ updatedLabel }}</span>
          <UButton
            icon="i-lucide-refresh-cw"
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            aria-label="Refresh"
            @click="refresh()"
          />
        </div>
      </div>

      <div v-if="!board.rows.length" class="py-12 text-center text-muted">
        <UIcon name="i-lucide-trophy" class="size-10 mb-2 opacity-40" />
        <p>No final submissions yet.</p>
      </div>

      <div v-else class="overflow-auto max-h-[calc(100vh-12rem)] rounded-lg border border-default">
        <table class="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr class="text-left">
              <th class="sb-sticky-head left-0 z-30 w-12 text-center">
                #
              </th>
              <th class="sb-sticky-head left-12 z-30 min-w-32">
                User
              </th>
              <th v-for="p in board.problems" :key="p.id" class="sb-head text-center min-w-20">
                <NuxtLink :to="`/problems/${data.assignment.id}/${p.id}`" class="hover:text-primary" dir="auto">
                  {{ p.name }}
                </NuxtLink>
                <div class="text-[11px] font-normal text-dimmed">
                  {{ p.score }}
                </div>
              </th>
              <th class="sb-head text-center min-w-24">
                Total
                <div class="text-[11px] font-normal text-dimmed">
                  {{ board.totalScore }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in board.rows"
              :key="row.username"
              class="group"
              :class="row.username === me?.username ? 'sb-me' : ''"
            >
              <td class="sb-cell sb-sticky left-0 text-center">
                <span
                  class="inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-1"
                  :class="rankClass(row.rank)"
                >{{ row.rank }}</span>
              </td>
              <td class="sb-cell sb-sticky left-12">
                <div class="font-medium text-highlighted truncate max-w-48" dir="auto">
                  {{ row.displayName || row.username }}
                </div>
                <div class="text-xs text-muted">
                  {{ row.username }}
                </div>
              </td>
              <td v-for="p in board.problems" :key="p.id" class="sb-cell text-center tabular-nums">
                <template v-if="row.scores[p.id]">
                  <div :class="cellClass(row.scores[p.id]!.score, p.score)">
                    {{ row.scores[p.id]!.score }}
                  </div>
                  <div class="text-[11px] text-dimmed" title="Time">
                    {{ hhmm(row.scores[p.id]!.time) }}
                  </div>
                </template>
                <span v-else class="text-dimmed">-</span>
              </td>
              <td class="sb-cell text-center tabular-nums">
                <div class="font-bold text-highlighted">
                  {{ row.total }}
                </div>
                <div class="text-[11px] text-dimmed" title="Total Time + Submit Penalty">
                  {{ hhmm(row.penalty) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AppPage>
</template>

<style scoped>
.sb-head,
.sb-sticky-head {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  background: var(--ui-bg-elevated);
  border-bottom: 1px solid var(--ui-border);
  white-space: nowrap;
}
.sb-sticky-head {
  z-index: 30;
}
.sb-cell {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg);
}
.sb-sticky {
  position: sticky;
  z-index: 10;
}
tbody tr:last-child .sb-cell {
  border-bottom: 0;
}
tbody tr:hover .sb-cell {
  background: color-mix(in oklab, var(--ui-bg-elevated) 70%, var(--ui-bg));
}
tr.sb-me .sb-cell {
  background: color-mix(in oklab, var(--ui-primary) 12%, var(--ui-bg));
}
tr.sb-me .sb-sticky:first-child {
  box-shadow: inset 3px 0 0 var(--ui-primary);
}
</style>
