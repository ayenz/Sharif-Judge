<script setup lang="ts">
import { CHEAT_LANGUAGE_LABEL } from '#shared/cheat'
import type { CheatOverview } from '~/utils/cheat'

const props = defineProps<{ overview: CheatOverview }>()

type Run = CheatOverview['runs'][number]

const problemName = (id: number) => props.overview.problems.find(p => p.id === id)?.name ?? `Problem ${id}`

const STATUS = {
  queued: { icon: 'i-lucide-clock', label: 'Queued', class: 'text-muted' },
  running: { icon: 'i-lucide-loader-circle', label: 'Running', class: 'text-primary' },
  done: { icon: 'i-lucide-circle-check', label: 'Done', class: 'text-success' },
  failed: { icon: 'i-lucide-circle-x', label: 'Failed', class: 'text-error' },
} as const

function summary(run: Run) {
  if (run.status === 'done')
    return `${run.submissions} submissions · ${formatDateTime(run.finishedAt)}`
  if (run.status === 'failed')
    return run.error ? run.error.split('\n')[0] : 'The analysis failed.'
  if (run.status === 'running')
    return 'Comparing…'
  return 'Waiting for its turn…'
}

const reportTip = (run: Run) => `Download the JPlag report${run.reportSize ? ` (${cheatBytes(run.reportSize)})` : ''}. Open it in the official viewer at jplag.github.io/JPlag for a detailed view.`
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <div
      v-for="run in overview.runs"
      :key="run.id"
      class="rounded-lg border bg-default px-3 py-2.5 flex items-start gap-3 transition-colors"
      :class="run.status === 'failed' ? 'border-error/40' : run.status === 'running' ? 'border-primary/50' : 'border-default'"
    >
      <UIcon
        :name="STATUS[run.status].icon"
        class="size-5 shrink-0 mt-0.5"
        :class="[STATUS[run.status].class, run.status === 'running' ? 'animate-spin' : '']"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium truncate" dir="auto">
          {{ run.problem }}. {{ problemName(run.problem) }}
          <span class="text-muted font-normal">· {{ CHEAT_LANGUAGE_LABEL[run.language] }}</span>
        </p>
        <UTooltip v-if="run.status === 'failed'" :text="run.error || 'The analysis failed.'" :content="{ side: 'bottom' }">
          <p class="text-xs text-error truncate cursor-help">
            {{ summary(run) }}
          </p>
        </UTooltip>
        <p v-else class="text-xs text-muted truncate">
          {{ summary(run) }}
        </p>
        <p v-if="run.status === 'done' && run.error" class="mt-1 flex items-start gap-1 text-xs text-warning">
          <UIcon name="i-lucide-info" class="size-3.5 mt-px shrink-0" />
          <span>{{ run.error }}</span>
        </p>
        <UPopover v-if="run.failed.length" mode="hover" :content="{ side: 'bottom', align: 'start' }">
          <button type="button" class="mt-1 inline-flex items-center gap-1 text-xs text-warning hover:underline">
            <UIcon name="i-lucide-file-warning" class="size-3.5" />
            {{ run.failed.length }} not compared
          </button>
          <template #content>
            <div class="p-3 max-w-72 text-xs space-y-1">
              <p class="text-muted">
                These submissions were not compared, because they are too short for a reliable comparison or have syntax JPlag could not read:
              </p>
              <p class="font-mono break-words">
                {{ run.failed.join(', ') }}
              </p>
            </div>
          </template>
        </UPopover>
        <p v-if="run.options.compareAssignments.length || run.options.minTokens || run.options.baseCode" class="mt-1 flex flex-wrap gap-1">
          <UBadge v-if="run.options.compareAssignments.length" size="sm" color="neutral" variant="soft" icon="i-lucide-history" :label="`+${run.options.compareAssignments.length} older`" />
          <UBadge v-if="run.options.minTokens" size="sm" color="neutral" variant="soft" :label="`min ${run.options.minTokens} tokens`" />
          <UBadge v-if="run.options.baseCode" size="sm" color="neutral" variant="soft" icon="i-lucide-file-code" label="template" />
        </p>
      </div>
      <UTooltip v-if="run.status === 'done' && run.reportSize" :text="reportTip(run)">
        <UButton
          icon="i-lucide-download"
          size="xs"
          color="neutral"
          variant="ghost"
          :to="`/api/cheat/runs/${run.id}/report`"
          external
          download
          aria-label="Download JPlag report"
        />
      </UTooltip>
    </div>
  </div>
</template>
