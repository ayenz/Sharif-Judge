<script setup lang="ts">
import { CHEAT_LANGUAGE_LABEL, type CheatPair } from '#shared/cheat'
import type { CheatProblemInfo } from '~/utils/cheat'

const props = defineProps<{ pairs: CheatPair[], problems: CheatProblemInfo[], loading: boolean, analysed: boolean }>()

const THRESHOLDS = [0, 30, 50, 70, 90]
const min = ref(30)
const problem = ref(0)

const problemItems = computed(() => [
  { label: 'All problems', value: 0 },
  ...props.problems.map(p => ({ label: `${p.id}. ${p.name}`, value: p.id })),
])
const problemName = (id: number) => props.problems.find(p => p.id === id)?.name ?? ''

const rows = computed(() => props.pairs.filter(p =>
  p.similarity * 100 >= min.value && (!problem.value || p.problem === problem.value)))

function open(pair: CheatPair) {
  navigateTo(`/cheat/pair/${pair.id}`)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-2 me-auto">
        <span class="text-xs text-muted">Min. similarity</span>
        <UFieldGroup size="sm">
          <UButton
            v-for="t in THRESHOLDS"
            :key="t"
            :label="`${t}%`"
            :color="min === t ? 'primary' : 'neutral'"
            :variant="min === t ? 'solid' : 'outline'"
            @click="min = t"
          />
        </UFieldGroup>
      </div>
      <USelect v-model="problem" :items="problemItems" size="sm" class="w-44" />
    </div>

    <div class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/60 text-xs uppercase tracking-wide text-muted">
          <tr class="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-left [&>th]:whitespace-nowrap">
            <th>Similarity</th>
            <th>Students</th>
            <th>Problem</th>
            <th>Language</th>
            <th>Longest match</th>
            <th class="w-8">
              <span class="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody v-if="loading && !pairs.length">
          <tr v-for="i in 5" :key="i">
            <td colspan="6" class="px-3 py-2">
              <USkeleton class="h-7 w-full" />
            </td>
          </tr>
        </tbody>
        <tbody v-else class="divide-y divide-default">
          <tr
            v-for="p in rows"
            :key="p.id"
            tabindex="0"
            class="group cursor-pointer [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap hover:bg-elevated/50 focus:outline-none focus-visible:bg-elevated transition-colors"
            @click="open(p)"
            @keydown.enter="open(p)"
          >
            <td>
              <div class="flex items-center gap-2 w-36">
                <div class="h-2 flex-1 rounded-full bg-elevated overflow-hidden">
                  <div class="h-full rounded-full" :class="cheatSimilarityTone(p.similarity).bar" :style="{ width: `${Math.max(p.similarity * 100, 2)}%` }" />
                </div>
                <span class="tabular-nums font-semibold w-10 text-right" :class="cheatSimilarityTone(p.similarity).text">{{ cheatPercent(p.similarity) }}</span>
              </div>
            </td>
            <td>
              <div class="flex items-center gap-2">
                <div>
                  <span class="font-medium">{{ p.a.username }}</span>
                  <span v-if="p.a.displayName" class="block text-xs text-muted truncate max-w-36" dir="auto">{{ p.a.displayName }}</span>
                </div>
                <UIcon name="i-lucide-arrow-left-right" class="size-4 text-dimmed shrink-0" />
                <div>
                  <span class="font-medium">{{ p.b.username }}</span>
                  <span v-if="p.b.old" class="block text-xs text-warning truncate max-w-48" dir="auto">older: {{ p.b.assignmentName }}</span>
                  <span v-else-if="p.b.displayName" class="block text-xs text-muted truncate max-w-36" dir="auto">{{ p.b.displayName }}</span>
                </div>
              </div>
            </td>
            <td :title="problemName(p.problem)">
              {{ p.problem }}<span class="text-muted hidden md:inline" dir="auto"> · {{ problemName(p.problem) }}</span>
            </td>
            <td>
              <UBadge color="neutral" variant="soft" size="sm" :label="CHEAT_LANGUAGE_LABEL[p.language]" />
            </td>
            <td class="tabular-nums text-muted">
              {{ p.longestMatch }} tokens
            </td>
            <td>
              <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </td>
          </tr>
        </tbody>
      </table>
      <UEmpty
        v-if="!loading && !analysed"
        icon="i-lucide-scan-search"
        title="No analysis yet"
        description="Run an analysis to find similar submissions."
        class="py-10"
      />
      <UEmpty
        v-else-if="!loading && !rows.length"
        icon="i-lucide-shield-check"
        title="No similar pairs"
        :description="min > 0 ? `No pair is at least ${min}% similar. Lower the threshold to see more.` : 'No pairs were found.'"
        class="py-10"
      />
    </div>
    <p class="text-xs text-muted flex items-start gap-1.5">
      <UIcon name="i-lucide-info" class="size-3.5 mt-0.5 shrink-0" />
      <span>Similarity is the share of both programs covered by matching sections. Simple problems naturally produce similar solutions; open a pair to compare the code.</span>
    </p>
  </div>
</template>
