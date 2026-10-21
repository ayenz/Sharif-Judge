<script setup lang="ts">
interface HofAssignmentDetail {
  id: number
  name: string
  scoreboard: boolean
  problems: { id: number, name: string, score: number | null }[]
}

const props = defineProps<{ username: string }>()

const { data, status, error } = useFetch<HofAssignmentDetail[]>(
  () => `/api/hall-of-fame/${encodeURIComponent(props.username)}`,
  { key: `hof-${props.username}`, default: () => [], server: false },
)

function total(a: HofAssignmentDetail) {
  return a.problems.reduce((sum, p) => sum + (p.score ?? 0), 0)
}
</script>

<template>
  <div>
    <div v-if="status === 'pending'" class="space-y-2">
      <USkeleton v-for="i in 3" :key="i" class="h-16 w-full" />
    </div>
    <UAlert v-else-if="error" color="error" variant="subtle" :title="apiError(error).message" />
    <p v-else-if="!data.length" class="py-6 text-center text-muted">
      No scored final submissions.
    </p>
    <div v-else class="space-y-3">
      <div v-for="a in data" :key="a.id" class="rounded-lg border border-default">
        <div class="flex items-center justify-between gap-2 px-3 py-2 bg-elevated/50 rounded-t-lg">
          <span class="font-medium text-highlighted truncate" dir="auto">{{ a.name }}</span>
          <UBadge v-if="!a.scoreboard" color="neutral" variant="subtle" icon="i-lucide-eye-off" size="sm">
            Scoreboard disabled
          </UBadge>
          <span v-else class="text-sm font-semibold tabular-nums">{{ total(a) }}</span>
        </div>
        <ul v-if="a.scoreboard" class="divide-y divide-default text-sm">
          <li v-for="p in a.problems" :key="p.id" class="flex justify-between gap-2 px-3 py-1.5">
            <span class="text-muted truncate" dir="auto">{{ p.name }}</span>
            <span class="tabular-nums">{{ p.score }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
