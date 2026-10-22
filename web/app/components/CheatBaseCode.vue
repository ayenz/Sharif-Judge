<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { CHEAT_LANGUAGE_LABEL, CHEAT_LANGUAGES, type CheatLanguage } from '#shared/cheat'
import type { CheatProblemInfo } from '~/utils/cheat'

const props = defineProps<{ assignmentId: number, problems: CheatProblemInfo[] }>()
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()

type Codes = Record<CheatLanguage, string>

const problemId = ref(props.problems.find(p => !p.isUploadOnly)?.id ?? props.problems[0]?.id ?? 0)
const language = ref<CheatLanguage>('cpp')
const saved = reactive<Record<number, Codes>>({})
const drafts = reactive<Record<number, Codes>>({})
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)

const problemItems = computed(() => props.problems.map(p => ({ label: `${p.id}. ${p.name}`, value: p.id })))
const current = computed(() => props.problems.find(p => p.id === problemId.value))

const tabs = computed<TabsItem[]>(() => CHEAT_LANGUAGES.map(l => ({
  label: CHEAT_LANGUAGE_LABEL[l],
  value: l,
  icon: saved[problemId.value]?.[l]?.trim() ? 'i-lucide-file-check' : undefined,
})))

// Load a problem's template code the first time it is shown.
async function load(id: number) {
  if (!id || saved[id])
    return
  loading.value = true
  loadError.value = ''
  try {
    const codes = await api<Codes>(`/api/cheat/${props.assignmentId}/${id}/basecode`)
    saved[id] = { ...codes }
    drafts[id] = { ...codes }
    // Open the first language that has code or submissions.
    const p = props.problems.find(x => x.id === id)
    language.value = CHEAT_LANGUAGES.find(l => codes[l]?.trim()) ?? CHEAT_LANGUAGES.find(l => p?.counts[l]) ?? language.value
  }
  catch (e) {
    loadError.value = apiError(e).message
  }
  finally {
    loading.value = false
  }
}
watch(problemId, load, { immediate: true })

const draft = computed({
  get: () => drafts[problemId.value]?.[language.value] ?? '',
  set: (v: string) => {
    if (drafts[problemId.value])
      drafts[problemId.value]![language.value] = v
  },
})
const dirty = computed(() => (saved[problemId.value]?.[language.value] ?? '') !== draft.value)
const hasSaved = computed(() => !!saved[problemId.value]?.[language.value]?.trim())

async function save(content = draft.value) {
  saving.value = true
  try {
    await api(`/api/cheat/${props.assignmentId}/${problemId.value}/basecode`, { method: 'PUT', body: { language: language.value, content } })
    saved[problemId.value]![language.value] = content
    drafts[problemId.value]![language.value] = content
    toast.add({
      title: content.trim() ? 'Template code saved' : 'Template code removed',
      description: 'It applies to the next analysis.',
      color: 'success',
      icon: 'i-lucide-check',
    })
    emit('saved')
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="primary"
      variant="subtle"
      icon="i-lucide-file-code"
      title="Code you give to everyone"
      description="If students start from starter code you provided, paste it here. Matches inside this template are ignored, so shared starter code does not look like copying. Used by JPlag and by Moss on the next run."
    />

    <UEmpty v-if="!problems.length" icon="i-lucide-file-x" title="This assignment has no problems" class="py-10" />

    <UCard v-else :ui="{ body: 'p-0 sm:p-0', header: 'p-3 sm:px-4' }">
      <template #header>
        <div class="flex flex-wrap items-center gap-2">
          <USelect v-model="problemId" :items="problemItems" size="sm" class="w-56" />
          <UBadge v-if="current?.isUploadOnly" size="sm" color="neutral" variant="soft" label="Upload only" />
          <UTabs v-model="language" :items="tabs" :content="false" variant="link" size="sm" class="ms-auto" :ui="{ list: 'tabs-scroll' }" />
        </div>
      </template>

      <div v-if="loading" class="p-4">
        <USkeleton class="h-72 w-full" />
      </div>
      <UAlert v-else-if="loadError" class="m-4" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="loadError">
        <template #actions>
          <UButton size="xs" color="neutral" variant="outline" label="Retry" @click="load(problemId)" />
        </template>
      </UAlert>
      <div v-else class="p-3 sm:p-4 space-y-3">
        <UTextarea
          v-model="draft"
          :rows="16"
          autoresize
          :maxrows="32"
          spellcheck="false"
          autocomplete="off"
          :placeholder="`Paste the ${CHEAT_LANGUAGE_LABEL[language]} starter code here…`"
          class="w-full"
          :ui="{ base: 'font-mono text-xs leading-relaxed' }"
        />
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted me-auto">
            {{ hasSaved ? 'Template saved for this language.' : 'No template for this language.' }}
            <span v-if="dirty" class="text-warning">Unsaved changes.</span>
          </span>
          <UButton v-if="hasSaved" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" label="Remove" :disabled="saving" @click="save('')" />
          <UButton size="sm" icon="i-lucide-save" label="Save" :loading="saving" :disabled="!dirty" @click="save()" />
        </div>
      </div>
    </UCard>
  </div>
</template>
