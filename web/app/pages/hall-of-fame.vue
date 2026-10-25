<script setup lang="ts">
interface HofEntry { rank: number, username: string, displayName: string, totalScore: number }

const { me } = useMe()
const { data, status } = useFetch<HofEntry[]>('/api/hall-of-fame', { key: 'hall-of-fame', default: () => [] })

const search = ref('')
const podium = computed(() => data.value.filter(e => e.rank <= 3).slice(0, 3))
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q)
    return data.value
  return data.value.filter(e => e.username.toLowerCase().includes(q) || e.displayName.toLowerCase().includes(q))
})

const selected = ref<HofEntry | null>(null)
const open = computed({
  get: () => selected.value !== null,
  set: (v: boolean) => {
    if (!v)
      selected.value = null
  },
})

const medal: Record<number, { ring: string, text: string, icon: string, height: string }> = {
  1: { ring: 'ring-amber-400/60 bg-amber-400/10', text: 'text-amber-500 dark:text-amber-300', icon: 'i-lucide-crown', height: 'sm:pt-0' },
  2: { ring: 'ring-slate-400/60 bg-slate-400/10', text: 'text-slate-500 dark:text-slate-300', icon: 'i-lucide-medal', height: 'sm:pt-6' },
  3: { ring: 'ring-orange-400/60 bg-orange-400/10', text: 'text-orange-600 dark:text-orange-300', icon: 'i-lucide-award', height: 'sm:pt-10' },
}

// Podium order on wide screens: 2nd, 1st, 3rd.
const podiumOrder = computed(() => {
  const p = podium.value
  return p.length === 3 ? [p[1]!, p[0]!, p[2]!] : p
})
</script>

<template>
  <AppPage title="Hall of Fame" icon="i-lucide-medal">
    <div v-if="status === 'pending' && !data.length" class="space-y-2">
      <USkeleton class="h-32 w-full" />
      <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
    </div>

    <div v-else-if="!data.length" class="py-12 text-center text-muted">
      <UIcon name="i-lucide-medal" class="size-10 mb-2 opacity-40" />
      <p>No final submissions yet.</p>
    </div>

    <template v-else>
      <div class="grid gap-3 sm:grid-cols-3 sm:items-start mb-6">
        <button
          v-for="entry in podiumOrder"
          :key="entry.username"
          type="button"
          class="text-left"
          :class="medal[entry.rank]?.height"
          @click="selected = entry"
        >
          <UCard
            :ui="{ body: 'p-4 sm:p-5' }"
            class="ring-1 transition hover:shadow-md hover:-translate-y-0.5"
            :class="medal[entry.rank]?.ring"
          >
            <div class="flex items-center gap-3">
              <div class="flex flex-col items-center" :class="medal[entry.rank]?.text">
                <UIcon :name="medal[entry.rank]?.icon ?? 'i-lucide-medal'" class="size-7" />
                <span class="text-xs font-bold">#{{ entry.rank }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-highlighted truncate" dir="auto">
                  {{ entry.displayName || entry.username }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ entry.username }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold tabular-nums text-highlighted">
                  {{ entry.totalScore }}
                </p>
                <p class="text-[11px] text-muted">
                  points
                </p>
              </div>
            </div>
          </UCard>
        </button>
      </div>

      <div class="flex items-center justify-between gap-2 mb-3">
        <p class="text-sm text-muted">
          {{ data.length }} users ranked by total score of final submissions. Click a row for details.
        </p>
        <UInput v-model="search" icon="i-lucide-search" placeholder="Search…" size="sm" class="w-40 sm:w-56" />
      </div>

      <div class="overflow-x-auto rounded-lg border border-default">
        <table class="data-table">
          <thead>
            <tr>
              <th class="w-16 text-center">
                Rank
              </th>
              <th>
                Display Name
              </th>
              <th>
                Username
              </th>
              <th class="text-right">
                Total Score
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in filtered"
              :key="entry.username"
              tabindex="0"
              class="cursor-pointer hover:bg-elevated/60 focus:outline-none focus-visible:bg-elevated"
              :class="entry.username === me?.username ? 'bg-primary/10' : ''"
              @click="selected = entry"
              @keydown.enter="selected = entry"
            >
              <td class="text-center">
                <span
                  class="inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold"
                  :class="entry.rank <= 3 ? [medal[entry.rank]?.ring, medal[entry.rank]?.text, 'ring-1'] : 'text-muted'"
                >{{ entry.rank }}</span>
              </td>
              <td class="font-medium text-highlighted" dir="auto">
                {{ entry.displayName }}
              </td>
              <td class="text-muted">
                {{ entry.username }}
              </td>
              <td class="text-right font-semibold tabular-nums">
                {{ entry.totalScore }}
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="4" class="text-center text-muted">
                No matching users.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <UModal
      v-model:open="open"
      :title="selected ? (selected.displayName || selected.username) : ''"
      :description="selected ? `${selected.username} · rank #${selected.rank} · ${selected.totalScore} points` : ''"
    >
      <template #body>
        <HofDetails v-if="selected" :username="selected.username" />
      </template>
    </UModal>
  </AppPage>
</template>
