<script setup lang="ts">
import { CHEAT_LANGUAGE_LABEL, type CheatPairDetail, type CheatSubmissionRef } from '#shared/cheat'
import type { CheatOverview } from '~/utils/cheat'

definePageMeta({ minLevel: 2 })

const route = useRoute()
const id = computed(() => Number(route.params.id) || 0)
const { data, status, error, refresh } = useFetch<CheatPairDetail>(() => `/api/cheat/pairs/${id.value}`, { key: () => `cheat-pair-${id.value}` })

// Problem name only (the pair detail has the id); loaded after the page shows.
const assignmentId = computed(() => data.value?.a.assignment ?? 0)
const { data: overview, execute: loadOverview } = useLazyFetch<CheatOverview>(() => `/api/cheat/${assignmentId.value}`, {
  key: () => `cheat-${assignmentId.value}`,
  server: false,
  immediate: false,
  watch: false,
})
onMounted(() => watch(assignmentId, (a) => {
  if (a && !overview.value)
    loadOverview()
}, { immediate: true }))
const problemName = computed(() => overview.value?.problems.find(p => p.id === data.value?.problem)?.name ?? '')

useHead({
  title: () => data.value ? `${data.value.a.username} ↔ ${data.value.b.username} · Cheat Detection` : 'Compare submissions',
}, { tagPriority: 'high' })

const matches = computed(() => (data.value?.matches ?? [])
  .map((m, index) => ({ ...m, index }))
  .sort((x, y) => x.aStart - y.aStart))
const rangesA = computed(() => (data.value?.matches ?? []).map(m => ({ start: m.aStart, end: m.aEnd })))
const rangesB = computed(() => (data.value?.matches ?? []).map(m => ({ start: m.bStart, end: m.bEnd })))

type Pane = { scrollToLine: (line: number) => void } | null
const panes: Pane[] = [null, null]
const active = ref<number | null>(null)
const pulse = ref(0)

function focusMatch(index: number) {
  const m = data.value?.matches[index]
  if (!m)
    return
  active.value = index
  pulse.value++
  panes[0]?.scrollToLine(m.aStart)
  panes[1]?.scrollToLine(m.bStart)
}

const submissionsLink = (ref: CheatSubmissionRef) => `/submissions/all?user=${encodeURIComponent(ref.username)}&problem=${ref.problem}`
const tone = computed(() => cheatSimilarityTone(data.value?.similarity ?? 0))
</script>

<template>
  <AppPage title="Compare Submissions" icon="i-lucide-git-compare" wide>
    <div v-if="!data && status === 'pending'" class="space-y-4">
      <USkeleton class="h-28 w-full" />
      <div class="grid gap-4 lg:grid-cols-2">
        <USkeleton class="h-96" />
        <USkeleton class="h-96" />
      </div>
    </div>

    <UAlert
      v-else-if="error || !data"
      icon="i-lucide-circle-alert"
      color="error"
      variant="subtle"
      :title="error ? apiError(error).message : 'Pair not found'"
      description="The analysis may have been run again since this link was made."
    >
      <template #actions>
        <UButton size="xs" color="neutral" variant="outline" label="Retry" @click="refresh()" />
        <UButton size="xs" color="neutral" variant="ghost" label="Back to cheat detection" :to="`/cheat/${useMe().me.value?.selectedAssignment.id ?? 0}`" />
      </template>
    </UAlert>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :to="`/cheat/${data.a.assignment}?tab=pairs`"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Similar pairs"
        />
        <span class="text-sm text-muted truncate" dir="auto">
          {{ data.a.assignmentName }} · Problem {{ data.problem }}<template v-if="problemName"> · {{ problemName }}</template>
        </span>
        <UBadge color="neutral" variant="soft" size="sm" :label="CHEAT_LANGUAGE_LABEL[data.language]" />
      </div>

      <UCard :ui="{ body: 'p-4 sm:p-5' }">
        <div class="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div v-for="(side, i) in [data.a, data.b]" :key="i" class="min-w-0 flex items-center gap-3" :class="i === 1 ? 'md:order-3 md:justify-end md:text-right' : ''">
            <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" :class="[i === 0 ? 'bg-primary/15 text-primary' : 'bg-elevated text-highlighted', i === 1 ? 'md:order-2' : '']">
              {{ i === 0 ? 'A' : 'B' }}
            </span>
            <div class="min-w-0">
              <p class="font-semibold text-highlighted truncate">
                {{ side.username }}
                <span v-if="side.displayName" class="font-normal text-muted text-sm" dir="auto">· {{ side.displayName }}</span>
              </p>
              <div class="flex flex-wrap items-center gap-1.5 mt-0.5" :class="i === 1 ? 'md:justify-end' : ''">
                <span class="text-xs text-muted">#{{ side.submitId }}</span>
                <UBadge v-if="side.old" size="sm" color="warning" variant="subtle" icon="i-lucide-history" :label="`older submission · ${side.assignmentName}`" />
                <UTooltip :text="side.old ? `Submissions pages show the selected assignment; select “${side.assignmentName}” to see these.` : 'Submissions pages show the selected assignment.'">
                  <ULink :to="submissionsLink(side)" class="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                    Submissions <UIcon name="i-lucide-arrow-up-right" class="size-3" />
                  </ULink>
                </UTooltip>
              </div>
            </div>
          </div>

          <div class="md:order-2 flex md:flex-col items-center justify-center gap-x-6 gap-y-1 border-y md:border-y-0 md:border-x border-default py-3 md:py-0 md:px-6">
            <div class="text-center">
              <p class="text-3xl font-bold tabular-nums" :class="tone.text">
                {{ cheatPercent(data.similarity) }}
              </p>
              <p class="text-[11px] uppercase tracking-wide text-muted">
                similar
              </p>
            </div>
            <div class="flex gap-4 text-xs text-muted">
              <UTooltip text="Share of the smaller program covered by matches">
                <span>max <span class="font-medium text-default tabular-nums">{{ cheatPercent(data.maxSimilarity) }}</span></span>
              </UTooltip>
              <UTooltip text="Tokens in the longest single matching section">
                <span>longest <span class="font-medium text-default tabular-nums">{{ data.longestMatch }}</span> tokens</span>
              </UTooltip>
            </div>
          </div>
        </div>
      </UCard>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
        <UCard v-for="(side, i) in [data.a, data.b]" :key="i" :ui="{ header: 'px-3 py-2 sm:px-4', body: 'p-0 sm:p-0' }" class="min-w-0">
          <template #header>
            <div class="flex items-center gap-2 text-sm">
              <span class="font-semibold">{{ i === 0 ? 'A' : 'B' }}</span>
              <span class="truncate">{{ side.username }}</span>
              <UBadge v-if="side.old" size="sm" color="warning" variant="subtle" label="older" />
            </div>
          </template>
          <CheatCodePane
            :ref="(el) => (panes[i] = el as Pane)"
            :code="i === 0 ? data.codeA : data.codeB"
            :ranges="i === 0 ? rangesA : rangesB"
            :active="active"
            :pulse="pulse"
            @select="focusMatch"
          />
        </UCard>

        <UCard :ui="{ header: 'px-3 py-2 sm:px-4', body: 'p-0 sm:p-0' }" class="lg:max-h-[calc(70vh+2.75rem)] flex flex-col">
          <template #header>
            <p class="text-sm font-semibold">
              Matches <span class="text-muted font-normal">· {{ matches.length }}</span>
            </p>
          </template>
          <ul class="divide-y divide-default overflow-y-auto max-h-72 lg:max-h-none">
            <li v-for="m in matches" :key="m.index">
              <button
                type="button"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-elevated/60 transition-colors"
                :class="active === m.index ? 'bg-elevated' : ''"
                @click="focusMatch(m.index)"
              >
                <span class="size-3 rounded-sm shrink-0" :style="{ background: cheatMatchColor(m.index) }" />
                <span class="tabular-nums flex-1">
                  A {{ m.aStart }}–{{ m.aEnd }}
                  <UIcon name="i-lucide-arrow-left-right" class="size-3 text-dimmed align-[-2px] mx-0.5" />
                  B {{ m.bStart }}–{{ m.bEnd }}
                </span>
                <span class="text-muted tabular-nums">{{ m.tokens }} tok</span>
              </button>
            </li>
            <li v-if="!matches.length" class="px-3 py-6 text-center text-xs text-muted">
              No matching sections.
            </li>
          </ul>
        </UCard>
      </div>

      <p class="text-xs text-muted flex items-start gap-1.5">
        <UIcon name="i-lucide-info" class="size-3.5 mt-0.5 shrink-0" />
        <span>
          Colored lines are sections JPlag found in both programs (the same color on both sides). Click a match or a colored line to line them up.
          Similar structure is common for short or standard solutions; this is a starting point for review, not proof.
        </span>
      </p>
    </div>
  </AppPage>
</template>
