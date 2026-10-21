<script setup lang="ts">
import type { RadioGroupItem } from '@nuxt/ui'
import { CHEAT_LANGUAGE_LABEL, CHEAT_LANGUAGES, type CheatLanguage } from '#shared/cheat'
import type { CheatOverview } from '~/utils/cheat'

const props = defineProps<{ overview: CheatOverview }>()
const emit = defineEmits<{ queued: [runIds: number[]], openTemplates: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()

type Sensitivity = 'default' | 'high' | 'low'
const SENSITIVITY: Record<Sensitivity, number | null> = { default: null, high: 6, low: 20 }
const sensitivityItems: RadioGroupItem[] = [
  { value: 'default', label: 'Default', description: 'JPlag\'s usual minimum match length for the language. A good start.' },
  { value: 'high', label: 'High sensitivity', description: 'Also reports short matching pieces (6 tokens). Finds more, but more of it is coincidence.' },
  { value: 'low', label: 'Low sensitivity', description: 'Only long matching pieces count (20 tokens). Fewer false alarms, may miss small copied parts.' },
]

const problems = ref<number[]>([])
const compare = ref<number[]>([])
const sensitivity = ref<Sensitivity>('default')
const submitting = ref(false)

// Reset to the defaults each time the dialog opens.
watch(open, (isOpen) => {
  if (!isOpen)
    return
  problems.value = props.overview.problems.filter(p => !p.isUploadOnly && codeCount(p) > 0).map(p => p.id)
  if (!problems.value.length)
    problems.value = props.overview.problems.filter(p => !p.isUploadOnly).map(p => p.id)
}, { immediate: true })

function codeCount(p: CheatOverview['problems'][number]) {
  return Object.values(p.counts).reduce((s, n) => s + (n ?? 0), 0)
}
function countsText(p: CheatOverview['problems'][number]) {
  const parts = CHEAT_LANGUAGES.filter(l => p.counts[l]).map(l => `${CHEAT_LANGUAGE_LABEL[l]} ${p.counts[l]}`)
  return parts.length ? `Final code submissions: ${parts.join(' · ')}` : 'No final code submissions yet'
}
function toggleProblem(id: number, on: boolean | 'indeterminate') {
  problems.value = on === true ? [...new Set([...problems.value, id])] : problems.value.filter(p => p !== id)
}

const compareItems = computed(() => props.overview.otherAssignments.map(a => ({
  label: a.archived ? `${a.name} (archived)` : a.name,
  value: a.id,
})))

const templates = computed(() => props.overview.problems
  .filter(p => problems.value.includes(p.id))
  .map(p => ({ problem: p, languages: CHEAT_LANGUAGES.filter(l => p.baseCode[l]) as CheatLanguage[] }))
  .filter(t => t.languages.length))

async function start() {
  submitting.value = true
  try {
    const res = await api<{ runIds: number[] }>(`/api/cheat/${props.overview.assignment.id}/run`, {
      method: 'POST',
      body: { problems: problems.value, compareAssignments: compare.value, minTokens: SENSITIVITY[sensitivity.value] },
    })
    toast.add({
      title: 'Analysis started',
      description: `${res.runIds.length} comparison${res.runIds.length === 1 ? '' : 's'} queued. Results appear here when they finish.`,
      color: 'success',
      icon: 'i-lucide-scan-search',
    })
    open.value = false
    emit('queued', res.runIds)
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Run analysis"
    description="Compare the final submissions of each problem, per language, with JPlag on this server."
    :ui="{ body: 'space-y-6', footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        v-if="!overview.engineAvailable"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="JPlag is not installed on this server"
        description="Ask the administrator to set it up. The Moss (legacy) tab still works."
      />

      <section class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-highlighted">
            Problems
          </h3>
          <div class="flex gap-1">
            <UButton size="xs" color="neutral" variant="ghost" label="All" @click="problems = overview.problems.map(p => p.id)" />
            <UButton size="xs" color="neutral" variant="ghost" label="None" @click="problems = []" />
          </div>
        </div>
        <ul class="rounded-lg border border-default divide-y divide-default">
          <li v-for="p in overview.problems" :key="p.id" class="px-3 py-2.5">
            <UCheckbox
              :model-value="problems.includes(p.id)"
              :description="p.isUploadOnly ? 'Upload-only problem: files are not compared' : countsText(p)"
              :ui="{ label: 'font-medium', description: 'text-xs' }"
              @update:model-value="toggleProblem(p.id, $event)"
            >
              <template #label>
                <span dir="auto">{{ p.id }}. {{ p.name }}</span>
              </template>
            </UCheckbox>
          </li>
          <li v-if="!overview.problems.length" class="px-3 py-4 text-sm text-muted text-center">
            This assignment has no problems.
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">
          Compare with other assignments
        </h3>
        <p class="text-xs text-muted">
          Also compares with final submissions of earlier assignments (for example last semester's), to spot reused work.
        </p>
        <USelectMenu
          v-model="compare"
          :items="compareItems"
          value-key="value"
          multiple
          placeholder="Only this assignment"
          icon="i-lucide-history"
          class="w-full"
        />
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">
          Sensitivity
        </h3>
        <URadioGroup v-model="sensitivity" :items="sensitivityItems" variant="card" size="sm" />
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold text-highlighted">
          Template code
        </h3>
        <div v-if="templates.length" class="rounded-lg bg-elevated/50 p-3 text-sm space-y-1">
          <p class="text-muted text-xs">
            Code you gave to everyone is ignored for:
          </p>
          <p v-for="t in templates" :key="t.problem.id" class="flex flex-wrap items-center gap-1">
            <span class="font-medium" dir="auto">{{ t.problem.id }}. {{ t.problem.name }}</span>
            <UBadge v-for="l in t.languages" :key="l" :label="CHEAT_LANGUAGE_LABEL[l]" size="sm" color="primary" variant="soft" />
          </p>
        </div>
        <p v-else class="text-sm text-muted">
          No template code is set for the selected problems. If students started from code you gave them,
          add it first so that shared starter code does not count as similarity.
        </p>
        <UButton size="xs" color="neutral" variant="link" icon="i-lucide-file-code" label="Edit template code" class="px-0" @click="open = false; emit('openTemplates')" />
      </section>
    </template>

    <template #footer>
      <span class="text-xs text-muted me-auto">Runs in the background, you can leave this page.</span>
      <UButton color="neutral" variant="ghost" label="Cancel" @click="open = false" />
      <UButton
        icon="i-lucide-play"
        label="Start analysis"
        :loading="submitting"
        :disabled="!problems.length || !overview.engineAvailable"
        @click="start"
      />
    </template>
  </USlideover>
</template>
