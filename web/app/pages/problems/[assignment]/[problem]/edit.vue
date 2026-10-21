<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

// Edit a problem description: ?type=md (Markdown), html (rich text) or plain (HTML source).
definePageMeta({ minLevel: 2 })

type EditType = 'md' | 'html' | 'plain'
interface DescriptionSource {
  assignment: { id: number, name: string }
  problem: { id: number, name: string }
  text: string
  hasMarkdown: boolean
}

const route = useRoute()
const toast = useToast()
const assignmentId = computed(() => Number(route.params.assignment) || 0)
const problemId = computed(() => Number(route.params.problem) || 0)
const type = computed<EditType>(() => (['md', 'html', 'plain'].includes(String(route.query.type)) ? route.query.type as EditType : 'md'))

const { data, error } = await useFetch<DescriptionSource>(
  () => `/api/problems/${assignmentId.value}/${problemId.value}/description`,
  { query: { type } },
)
if (error.value?.statusCode === 404)
  throw createError({ statusCode: 404, statusMessage: 'Problem not found', fatal: true })

const text = ref('')
const dirty = ref(false)
watch(data, (d) => {
  text.value = d?.text ?? ''
  dirty.value = false
}, { immediate: true })
watch(text, (v) => {
  if (v !== (data.value?.text ?? ''))
    dirty.value = true
})

const tabs: TabsItem[] = [
  { label: 'Markdown', icon: 'i-lucide-file-pen', value: 'md' },
  { label: 'Rich text', icon: 'i-lucide-pen-line', value: 'html' },
  { label: 'Plain HTML', icon: 'i-lucide-code', value: 'plain' },
]
const tab = computed({
  get: () => type.value,
  set: (v: EditType) => navigateTo({ query: { type: v } }, { replace: true }),
})

// Markdown live preview, rendered by the server with the same renderer used on save.
const preview = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
async function renderPreview() {
  try {
    preview.value = (await $fetch<{ html: string }>('/api/problems/markdown-preview', { method: 'POST', body: { text: text.value } })).html
  }
  catch {}
}
watch([text, type], () => {
  if (type.value !== 'md')
    return
  clearTimeout(timer)
  timer = setTimeout(renderPreview, 300)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/problems/${assignmentId.value}/${problemId.value}/description`, {
      method: 'PUT',
      body: { type: type.value === 'md' ? 'md' : 'html', text: text.value },
    })
    dirty.value = false
    toast.add({ title: 'Description saved.', color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/problems/${assignmentId.value}/${problemId.value}`)
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// Tab inserts a tab character in the source editors (legacy tabOverride); Esc leaves the field.
function insertTab(e: KeyboardEvent) {
  const el = e.target as HTMLTextAreaElement
  const start = el.selectionStart
  text.value = `${text.value.slice(0, start)}\t${text.value.slice(el.selectionEnd)}`
  nextTick(() => (el.selectionStart = el.selectionEnd = start + 1))
}

const backTo = computed(() => `/problems/${assignmentId.value}/${problemId.value}`)
</script>

<template>
  <AppPage title="Edit Problem Description" icon="i-lucide-file-pen">
    <UAlert v-if="error" color="error" variant="subtle" :title="apiError(error).message" />

    <div v-else-if="data" class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm text-muted truncate" dir="auto">
            Assignment {{ data.assignment.id }} · {{ data.assignment.name }}
          </p>
          <h1 class="text-xl font-semibold" dir="auto">
            <span class="text-muted">{{ data.problem.id }}.</span> {{ data.problem.name }}
          </h1>
        </div>
        <div class="flex gap-2">
          <UButton :to="backTo" color="neutral" variant="ghost" label="Cancel" />
          <UButton icon="i-lucide-save" label="Save" :loading="saving" @click="save" />
        </div>
      </div>

      <UTabs v-model="tab" :items="tabs" :content="false" class="w-full sm:w-auto" />

      <UAlert
        v-if="type !== 'md' && data.hasMarkdown"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="When you edit as HTML, the Markdown source of this description will be removed."
      />

      <!-- Markdown -->
      <div v-if="type === 'md'" class="grid gap-4 lg:grid-cols-2">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <p class="text-sm font-medium flex items-center gap-2">
              <UIcon name="i-lucide-file-pen" /> Markdown
              <span class="text-xs text-muted font-normal">fenced code: ```c, ```cpp, ```python, ```java</span>
            </p>
          </template>
          <UTextarea
            v-model="text"
            :rows="28"
            variant="none"
            dir="auto"
            spellcheck="false"
            class="w-full"
            :ui="{ base: 'font-mono text-sm p-4 min-h-[60vh]' }"
            aria-label="Markdown editor"
            @keydown.tab.exact.prevent="insertTab"
            @keydown.esc="($event.target as HTMLElement).blur()"
          />
        </UCard>
        <UCard>
          <template #header>
            <p class="text-sm font-medium flex items-center gap-2">
              <UIcon name="i-lucide-eye" /> Preview
            </p>
          </template>
          <div v-if="preview.trim()" class="prose-content" dir="auto" v-html="preview" />
          <p v-else class="text-sm text-muted">
            Nothing to preview yet.
          </p>
        </UCard>
      </div>

      <!-- Rich text -->
      <template v-else-if="type === 'html'">
        <p class="text-xs text-muted">
          The rich text editor may simplify complex HTML (tables, custom styles). Use <ULink :to="{ query: { type: 'plain' } }" class="text-primary">Plain HTML</ULink> for full control.
        </p>
        <ClientOnly>
          <LazyProblemRichEditor v-model="text" />
          <template #fallback>
            <USkeleton class="h-96 w-full" />
          </template>
        </ClientOnly>
      </template>

      <!-- Plain HTML -->
      <UCard v-else :ui="{ body: 'p-0 sm:p-0' }">
        <UTextarea
          v-model="text"
          :rows="30"
          variant="none"
          spellcheck="false"
          class="w-full"
          :ui="{ base: 'font-mono text-sm p-4 min-h-[60vh]' }"
          aria-label="HTML editor"
          @keydown.tab.exact.prevent="insertTab"
            @keydown.esc="($event.target as HTMLElement).blur()"
        />
      </UCard>

      <div class="flex justify-end gap-2">
        <span v-if="dirty" class="text-xs text-muted self-center">Unsaved changes</span>
        <UButton icon="i-lucide-save" label="Save" :loading="saving" @click="save" />
      </div>
    </div>
  </AppPage>
</template>
