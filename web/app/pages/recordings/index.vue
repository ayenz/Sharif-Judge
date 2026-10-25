<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const route = useRoute()
const router = useRouter()

const problem = computed(() => (typeof route.query.problem === 'string' ? route.query.problem : ''))
const user = computed(() => (typeof route.query.user === 'string' ? route.query.user : ''))

const { data, status } = useFetch('/api/recordings', {
  key: 'recordings',
  query: { problem, user },
})

const userInput = ref(user.value)
watch(user, v => (userInput.value = v))

function setFilter(next: { problem?: string | number, user?: string }) {
  const query: Record<string, string> = {}
  const p = next.problem !== undefined ? String(next.problem) : problem.value
  const u = next.user !== undefined ? next.user : user.value
  if (p)
    query.problem = p
  if (u)
    query.user = u
  router.replace({ query })
}

// Select items cannot have an empty value, so "all" stands for no filter.
const problemItems = computed(() => [
  { label: 'All problems', value: 'all' },
  ...(data.value?.problems ?? []).map(p => ({ label: `${p.id}. ${p.name}`, value: String(p.id) })),
])
const problemModel = computed({
  get: () => problem.value || 'all',
  set: (v: string) => setFilter({ problem: v === 'all' ? '' : v }),
})
const problemName = computed(() => Object.fromEntries((data.value?.problems ?? []).map(p => [p.id, p.name])))

function onUserSubmit() {
  setFilter({ user: userInput.value.trim().toLowerCase() })
}
</script>

<template>
  <AppPage title="Recordings" icon="i-lucide-video">
    <UAlert
      v-if="data && !data.assignment"
      icon="i-lucide-folder-x"
      color="neutral"
      variant="subtle"
      title="No assignment selected."
      description="Pick an assignment from the selector at the top."
    />

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
        <p class="text-sm text-muted">
          Code recordings of
          <span dir="auto" class="font-medium text-highlighted">{{ data?.assignment?.name }}</span>.
          Rec id 0 is the unsaved draft.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <USelect v-model="problemModel" :items="problemItems" class="w-48" icon="i-lucide-file-text" />
          <form class="flex gap-1" @submit.prevent="onUserSubmit">
            <UInput v-model="userInput" placeholder="Username" icon="i-lucide-user" class="w-40" />
            <UButton type="submit" color="neutral" variant="subtle" icon="i-lucide-filter" aria-label="Filter by user" />
          </form>
          <UButton
            v-if="problem || user"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="router.replace({ query: {} })"
          >
            Clear
          </UButton>
        </div>
      </div>

      <div v-if="status === 'pending' && !data" class="space-y-2">
        <USkeleton v-for="i in 6" :key="i" class="h-10 w-full" />
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="data-table whitespace-nowrap">
          <thead>
            <tr>
              <th>
                User
              </th>
              <th>
                Problem
              </th>
              <th class="text-right">
                Rec
              </th>
              <th>
                Uploaded at
              </th>
              <th class="text-right">
                Duration
              </th>
              <th class="text-right" title="Inserted characters (largest single insert)">
                Inserted (max)
              </th>
              <th class="text-right" title="Removed characters (largest single removal)">
                Removed (max)
              </th>
              <th class="text-right" title="Code churn rate">
                CCT
              </th>
              <th class="text-right">
                Input changes
              </th>
              <th class="text-right">
                Executes
              </th>
              <th class="text-right" title="Navigation in / out of the page">
                Nav in / out
              </th>
              <th class="col-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data?.recordings ?? []" :key="`${r.username}-${r.problem}-${r.recId}`" class="hover:bg-elevated/50">
              <td>
                <button type="button" class="text-left hover:text-primary" @click="setFilter({ user: r.username })">
                  <div class="font-medium" dir="auto">
                    {{ r.name || r.username }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ r.username }}
                  </div>
                </button>
              </td>
              <td>
                <button type="button" class="hover:text-primary" dir="auto" @click="setFilter({ problem: r.problem })">
                  {{ r.problem }}. {{ problemName[r.problem] ?? '' }}
                </button>
              </td>
              <td class="text-right tabular-nums">
                <UBadge v-if="r.recId === 0" color="neutral" variant="subtle" size="sm">
                  draft
                </UBadge>
                <span v-else>{{ r.recId }}</span>
              </td>
              <td class="text-muted">
                {{ formatDateTime(r.uploadAt) }}
              </td>
              <td class="text-right tabular-nums">
                {{ recordingDuration(r.duration) }}
              </td>
              <td class="text-right tabular-nums">
                {{ r.inserted }} <span class="text-muted">({{ r.maxInserted }})</span>
              </td>
              <td class="text-right tabular-nums">
                {{ r.removed }} <span class="text-muted">({{ r.maxRemoved }})</span>
              </td>
              <td class="text-right tabular-nums">
                {{ recordingCct(r.cct) }}
              </td>
              <td class="text-right tabular-nums">
                {{ r.totalInputChange }}
              </td>
              <td class="text-right tabular-nums">
                {{ r.totalExecute }}
              </td>
              <td class="text-right tabular-nums">
                {{ r.totalNavIn }} / {{ r.totalNavOut }}
              </td>
              <td class="text-right">
                <UButton
                  :to="`/recordings/${data?.assignment?.id}/${r.problem}/${r.username}?rec=${r.recId}`"
                  size="xs"
                  icon="i-lucide-play"
                  variant="soft"
                >
                  Replay
                </UButton>
              </td>
            </tr>
            <tr v-if="!data?.recordings.length">
              <td colspan="12" class="text-center text-muted">
                <UIcon name="i-lucide-video-off" class="size-8 mb-1 opacity-40" />
                <p>No recordings.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </AppPage>
</template>
