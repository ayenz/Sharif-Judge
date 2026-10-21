<script setup lang="ts">
export interface SubmissionRef {
  username: string
  assignment: number
  problem: number
  submitId: number
}

const props = defineProps<{ submission: SubmissionRef | null, type: 'code' | 'result' | 'log' }>()
const open = defineModel<boolean>('open', { default: false })

const data = ref<{ fileName: string, text: string, lang?: string } | null>(null)
const error = ref('')
const loading = ref(false)

watch(() => [open.value, props.submission, props.type] as const, async ([isOpen, s, type]) => {
  if (!isOpen || !s)
    return
  loading.value = true
  error.value = ''
  data.value = null
  try {
    data.value = await api<{ fileName: string, text: string, lang?: string }>('/api/submissions/view', { method: 'POST', body: { ...s, type } })
  }
  catch (e) {
    error.value = apiError(e).message
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

const title = computed(() => {
  const s = props.submission
  const what = { code: 'Code', result: 'Result', log: 'Log' }[props.type]
  return s ? `${what} · ${s.username} · problem ${s.problem} · #${s.submitId}` : what
})
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="data?.fileName" :ui="{ content: 'sm:max-w-4xl' }">
    <template #body>
      <USkeleton v-if="loading" class="h-48 w-full" />
      <UAlert v-else-if="error" color="error" variant="subtle" :title="error" />
      <template v-else-if="data">
        <ClientOnly v-if="type === 'code'">
          <CodeViewer :code="data.text" :language="data.lang" />
        </ClientOnly>
        <!-- Result files are HTML produced by tester.sh (escaped by it). -->
        <div v-else-if="type === 'result'" class="judge-result" v-html="data.text" />
        <pre v-else class="judge-result max-h-[60vh] overflow-auto">{{ data.text }}</pre>
      </template>
    </template>
  </UModal>
</template>
