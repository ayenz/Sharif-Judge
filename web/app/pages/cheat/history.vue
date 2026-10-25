<script setup lang="ts">
import type { CheatHistory } from '#shared/cheat'

definePageMeta({ minLevel: 2 })

const route = useRoute()
const { me } = useMe()
const router = useRouter()

const THRESHOLDS = [
  { label: '50%+', value: 0.5 },
  { label: '70%+', value: 0.7 },
  { label: '90%+', value: 0.9 },
]
const min = computed({
  get: () => Number(route.query.min) || 0.7,
  set: v => router.replace({ query: { ...route.query, min: String(v) } }),
})

const { data, status } = await useFetch<CheatHistory>('/api/cheat/history', { query: { min } })

const search = ref('')
const students = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.students ?? []).filter(s => !q || s.username.includes(q) || s.displayName.toLowerCase().includes(q))
})
const expanded = ref<string | null>(null)

const pct = (v: number) => `${Math.round(v * 100)}%`
function simColor(v: number) {
  if (v >= 0.9)
    return 'error' as const
  if (v >= 0.7)
    return 'warning' as const
  return 'neutral' as const
}
</script>

<template>
  <AppPage title="Cheat History" icon="i-lucide-history">
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <UButton :to="`/cheat/${me?.selectedAssignment.id ?? 0}`" variant="link" color="neutral" icon="i-lucide-arrow-left" label="Cheat detection" class="px-0" />
          <p class="text-sm text-muted max-w-2xl">
            Similar code across every analysed assignment ({{ data?.analysedAssignments ?? 0 }}). Students who are similar to the same
            partner in several assignments are listed first; this points at what to review and is not a verdict.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">Similarity</span>
          <UTabs v-model="min" :items="THRESHOLDS" :content="false" size="xs" class="w-auto" />
        </div>
      </div>

      <USkeleton v-if="status === 'pending' && !data" class="h-64 w-full" />

      <template v-else-if="data">
        <section class="space-y-3">
          <h2 class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-repeat" class="text-primary" />
            Repeated pairs
            <UBadge :label="String(data.repeatPairs.length)" color="neutral" variant="soft" size="sm" />
          </h2>
          <UEmpty
            v-if="!data.repeatPairs.length"
            icon="i-lucide-users"
            title="No pair is similar in more than one assignment"
            description="Run the analysis on more assignments, or lower the similarity threshold."
            class="rounded-lg border border-dashed border-default py-8"
          />
          <div v-else class="grid gap-3 md:grid-cols-2">
            <UCard v-for="p in data.repeatPairs" :key="`${p.a.username}-${p.b.username}`" class="lift" :ui="{ body: 'p-4 sm:p-4 space-y-3' }">
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class="font-medium truncate">
                    {{ p.a.username }} <span class="text-muted">↔</span> {{ p.b.username }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ p.a.displayName }} · {{ p.b.displayName }}
                  </p>
                </div>
                <UBadge :label="`${p.count} assignments`" color="error" variant="subtle" icon="i-lucide-repeat" />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="a in p.assignments"
                  :key="a.id"
                  :to="`/cheat/pair/${a.pairId}`"
                  size="xs"
                  :color="simColor(a.similarity)"
                  variant="soft"
                  :label="`${a.name} · ${pct(a.similarity)}`"
                  trailing-icon="i-lucide-arrow-up-right"
                />
              </div>
            </UCard>
          </div>
        </section>

        <section class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-users" class="text-primary" />
              Students
              <UBadge :label="String(data.students.length)" color="neutral" variant="soft" size="sm" />
            </h2>
            <UInput v-model="search" icon="i-lucide-search" placeholder="Search student" size="sm" class="w-48" />
          </div>
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th class="text-right">
                    Assignments
                  </th>
                  <th>Highest similarity</th>
                  <th>Similar to</th>
                  <th class="col-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="s in students" :key="s.username">
                  <tr class="hover:bg-elevated/40 cursor-pointer" @click="expanded = expanded === s.username ? null : s.username">
                    <td>
                      <span class="font-medium">{{ s.username }}</span>
                      <span v-if="s.displayName" class="block text-xs text-muted">{{ s.displayName }}</span>
                    </td>
                    <td class="text-right tabular-nums">
                      <UBadge :label="String(s.flaggedAssignments)" :color="s.flaggedAssignments >= 2 ? 'error' : 'neutral'" variant="subtle" />
                    </td>
                    <td>
                      <div class="flex items-center gap-2 min-w-36">
                        <UProgress :model-value="Math.round(s.maxSimilarity * 100)" :color="simColor(s.maxSimilarity)" size="sm" class="w-24" />
                        <span class="tabular-nums">{{ pct(s.maxSimilarity) }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        <UBadge
                          v-for="p in s.partners.slice(0, 4)"
                          :key="p.username"
                          :label="p.count > 1 ? `${p.username} ×${p.count}` : p.username"
                          :color="p.count > 1 ? 'error' : 'neutral'"
                          variant="soft"
                          size="sm"
                        />
                        <span v-if="s.partners.length > 4" class="text-xs text-muted">+{{ s.partners.length - 4 }}</span>
                      </div>
                    </td>
                    <td class="text-right">
                      <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform duration-200" :class="expanded === s.username ? 'rotate-180' : ''" />
                    </td>
                  </tr>
                  <tr v-if="expanded === s.username" class="bg-elevated/25">
                    <td colspan="5">
                      <div class="flex flex-wrap gap-1.5">
                        <UButton
                          v-for="a in s.assignments"
                          :key="a.id"
                          :to="`/cheat/pair/${a.pairId}`"
                          size="xs"
                          :color="simColor(a.similarity)"
                          variant="soft"
                          :label="`${a.name} · ${pct(a.similarity)} with ${a.partner}`"
                          trailing-icon="i-lucide-arrow-up-right"
                        />
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <UEmpty v-if="!students.length" icon="i-lucide-shield-check" title="No similar code at this threshold" class="py-10" />
          </div>
        </section>
      </template>
    </div>
  </AppPage>
</template>
