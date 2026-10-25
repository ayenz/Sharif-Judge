<script setup lang="ts">
import type { CheatLevel, CheatStudentSignal } from '#shared/cheat'
import type { CheatProblemInfo } from '~/utils/cheat'

const props = defineProps<{ signals: CheatStudentSignal[], problems: CheatProblemInfo[], loading: boolean, analysed: boolean }>()

const level = ref<CheatLevel | 'all'>('all')
const problem = ref(0)
const search = ref('')

const levelItems = [
  { label: 'All levels', value: 'all' },
  { label: 'Needs review', value: 'high' },
  { label: 'Check', value: 'medium' },
  { label: 'OK', value: 'low' },
]
const problemItems = computed(() => [
  { label: 'All problems', value: 0 },
  ...props.problems.map(p => ({ label: `${p.id}. ${p.name}`, value: p.id })),
])

const counts = computed(() => {
  const c = { high: 0, medium: 0, low: 0 }
  for (const s of props.signals)
    c[s.level]++
  return c
})

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.signals.filter(s =>
    (level.value === 'all' || s.level === level.value)
    && (!problem.value || s.problem === problem.value)
    && (!q || s.username.toLowerCase().includes(q) || s.displayName.toLowerCase().includes(q)))
})
const filtered = computed(() => level.value !== 'all' || problem.value !== 0 || search.value.trim() !== '')
function clear() {
  level.value = 'all'
  problem.value = 0
  search.value = ''
}

function minutes(ms: number | null) {
  if (ms === null)
    return '—'
  return humanDuration(ms / 1000)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap gap-1.5 me-auto">
        <button
          v-for="l in (['high', 'medium', 'low'] as const)"
          :key="l"
          type="button"
          class="rounded-full transition-transform active:scale-95"
          :aria-pressed="level === l"
          @click="level = level === l ? 'all' : l"
        >
          <UBadge
            :color="CHEAT_LEVEL[l].color"
            :variant="level === l ? 'solid' : 'subtle'"
            :icon="CHEAT_LEVEL[l].icon"
            :label="`${CHEAT_LEVEL[l].label} · ${counts[l]}`"
            class="rounded-full"
          />
        </button>
      </div>
      <UInput v-model="search" icon="i-lucide-user-search" placeholder="Search student" size="sm" class="w-40" />
      <USelect v-model="level" :items="levelItems" size="sm" class="w-36" />
      <USelect v-model="problem" :items="problemItems" size="sm" class="w-44" />
      <UButton v-if="filtered" size="sm" color="neutral" variant="ghost" icon="i-lucide-filter-x" aria-label="Clear filters" @click="clear" />
    </div>

    <div class="overflow-x-auto rounded-lg border border-default">
      <table class="data-table">
        <thead>
          <tr>
            <th>Review</th>
            <th>Score</th>
            <th>Student</th>
            <th>Problem</th>
            <th>Similarity</th>
            <th>Closest match</th>
            <th>Indicators</th>
          </tr>
        </thead>
        <tbody v-if="loading && !signals.length">
          <tr v-for="i in 5" :key="i">
            <td colspan="7">
              <USkeleton class="h-7 w-full" />
            </td>
          </tr>
        </tbody>
        <TransitionGroup v-else tag="tbody" name="cheat-row">
          <tr
            v-for="s in rows"
            :key="`${s.username}-${s.problem}`"
            class="hover:bg-elevated/40 transition-colors"
          >
            <td>
              <UTooltip :text="CHEAT_LEVEL[s.level].hint">
                <UBadge :color="CHEAT_LEVEL[s.level].color" :variant="s.level === 'low' ? 'outline' : 'subtle'" :icon="CHEAT_LEVEL[s.level].icon" :label="CHEAT_LEVEL[s.level].label" />
              </UTooltip>
            </td>
            <td>
              <div class="flex items-center gap-2 w-28">
                <div class="h-1.5 flex-1 rounded-full bg-elevated overflow-hidden">
                  <div class="h-full rounded-full transition-[width] duration-500" :class="CHEAT_LEVEL[s.level].bar" :style="{ width: `${Math.max(s.score, 2)}%` }" />
                </div>
                <span class="tabular-nums text-xs text-muted w-6 text-right">{{ s.score }}</span>
              </div>
            </td>
            <td>
              <span class="font-medium">{{ s.username }}</span>
              <span v-if="s.displayName" class="block text-xs text-muted truncate max-w-40" dir="auto">{{ s.displayName }}</span>
            </td>
            <td :title="s.problemName">
              {{ s.problem }}<span class="text-muted hidden md:inline" dir="auto"> · {{ s.problemName }}</span>
            </td>
            <td>
              <span v-if="s.similarity === null" class="text-xs text-dimmed italic">not analysed</span>
              <span v-else class="tabular-nums font-medium" :class="cheatSimilarityTone(s.similarity).text">{{ cheatPercent(s.similarity) }}</span>
            </td>
            <td>
              <NuxtLink v-if="s.closest" :to="`/cheat/pair/${s.closest.pairId}`" class="inline-flex items-center gap-1.5 text-primary hover:underline">
                <UIcon name="i-lucide-git-compare" class="size-3.5" />
                {{ s.closest.username }}
                <UBadge v-if="s.closest.old" size="sm" color="neutral" variant="soft" label="older submission" />
              </NuxtLink>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td>
              <UPopover :content="{ side: 'left', align: 'center' }">
                <button type="button" class="flex flex-wrap gap-1 items-center text-left rounded-md focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`Indicators for ${s.username}`">
                  <UBadge
                    v-for="(r, i) in s.reasons"
                    :key="i"
                    size="sm"
                    :color="s.level === 'high' ? 'error' : s.level === 'medium' ? 'warning' : 'neutral'"
                    variant="soft"
                    :icon="cheatReasonChip(r).icon"
                    :label="cheatReasonChip(r).label"
                  />
                  <UBadge v-if="s.largestPaste === null" size="sm" color="neutral" variant="outline" icon="i-lucide-video-off" label="No editor recording" />
                  <span v-else-if="!s.reasons.length" class="text-xs text-dimmed">None</span>
                </button>
                <template #content>
                  <div class="p-3 w-72 space-y-2 text-xs">
                    <p class="font-semibold text-highlighted text-sm">
                      Indicators
                    </p>
                    <ul v-if="s.reasons.length" class="space-y-1 list-disc ps-4">
                      <li v-for="(r, i) in s.reasons" :key="i">
                        {{ r }}
                      </li>
                    </ul>
                    <p v-else class="text-muted">
                      Nothing notable.
                    </p>
                    <dl class="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-default pt-2 text-muted">
                      <dt>Largest paste</dt>
                      <dd class="text-right tabular-nums text-default">
                        {{ s.largestPaste === null ? '—' : `${s.largestPaste} chars` }}
                      </dd>
                      <dt>Left the page</dt>
                      <dd class="text-right tabular-nums text-default">
                        {{ s.tabSwitches === null ? '—' : `${s.tabSwitches}×` }}
                      </dd>
                      <dt>Editor time</dt>
                      <dd class="text-right tabular-nums text-default">
                        {{ minutes(s.duration) }}
                      </dd>
                      <dt>Final code</dt>
                      <dd class="text-right tabular-nums text-default">
                        {{ s.codeLength }} chars
                      </dd>
                    </dl>
                    <p v-if="s.largestPaste === null" class="text-muted">
                      No editor recording: the file was uploaded, so only code similarity is known.
                    </p>
                    <p class="text-dimmed">
                      Indicators point to what to look at; they are not proof.
                    </p>
                  </div>
                </template>
              </UPopover>
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <UEmpty
        v-if="!loading && !signals.length"
        icon="i-lucide-users"
        title="No code submissions yet"
        description="Students appear here once they have a final code submission."
        class="py-10"
      />
      <UEmpty
        v-else-if="!loading && !rows.length"
        icon="i-lucide-search-x"
        title="No students match these filters"
        class="py-10"
      />
    </div>
    <p class="text-xs text-muted flex items-start gap-1.5">
      <UIcon name="i-lucide-info" class="size-3.5 mt-0.5 shrink-0" />
      <span>
        The score adds up code similarity and editor recording signals (large pastes, leaving the page, very fast writing).
        It is a hint about where to look, not a verdict. Always check the code and the recording.
        <template v-if="!analysed"> Run an analysis to include code similarity.</template>
      </span>
    </p>
  </div>
</template>

<style scoped>
.cheat-row-enter-active { transition: opacity .2s ease, transform .2s var(--ease-out-soft); }
.cheat-row-enter-from { opacity: 0; transform: translateY(4px); }
</style>
