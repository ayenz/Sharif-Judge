<script setup lang="ts">
import type { Ace } from 'ace-builds'

// Built-in editor: write code, run it with custom input, submit it. Every edit is
// recorded (EditorRecorder) so instructors can replay how the code was written.

const props = defineProps<{
  assignmentId: number
  problemId?: number
  language?: string
  disabled?: boolean
}>()

const toast = useToast()
const colorMode = useColorMode()

const host = useTemplateRef<HTMLDivElement>('host')
const pdfFrame = useTemplateRef<HTMLIFrameElement>('pdfFrame')
let editor: Ace.Editor | undefined
let recorder: EditorRecorder | undefined

const ready = ref(false)
const busy = ref(false)
const status = ref('Select a problem and a language')
const input = ref('')
const output = ref('')
const running = ref(false)
const pdfUrl = ref<string | null>(null)
const showPdf = ref(true)

const canRun = computed(() => !!props.problemId && !!props.language && !props.disabled && ready.value && !busy.value)
const isTxt = computed(() => props.language?.toLowerCase() === 'txt')

onMounted(async () => {
  const ace = await loadAce()
  editor = ace.edit(host.value!, {
    fontSize: '14px',
    showPrintMargin: false,
    tabSize: 4,
    useSoftTabs: false,
    readOnly: true,
  })
  editor.setTheme(aceTheme(colorMode.value === 'dark'))
  recorder = new EditorRecorder(editor, ace, () => pdfFrame.value)
  ready.value = true
  await loadProblem()
})

onBeforeUnmount(() => {
  recorder?.stop()
  editor?.destroy()
})

watch(() => colorMode.value, dark => editor?.setTheme(aceTheme(dark === 'dark')))
watch(() => props.problemId, loadProblem)
watch(() => props.language, (lang) => {
  editor?.session.setMode(aceModeFor(lang ?? ''))
  editor?.setReadOnly(!canRun.value)
})
watch(canRun, ok => editor?.setReadOnly(!ok))

async function loadProblem() {
  if (!editor || !recorder)
    return
  input.value = ''
  output.value = ''
  if (!props.problemId) {
    editor.setValue('', -1)
    editor.setReadOnly(true)
    status.value = 'Select a problem and a language'
    return
  }
  busy.value = true
  try {
    recorder.start()
    const data = await $fetch<{ content: string, message: string, recording: string }>(`/api/submit/editor/${props.problemId}`)
    editor.setValue(data.content, -1)
    recorder.resetMetrics(data.content)
    recorder.previous = parseRecording(data.recording)
    status.value = data.message
  }
  catch (e) {
    status.value = apiError(e).message
  }
  finally {
    busy.value = false
  }
  loadPdf()
}

function parseRecording(text: string): Record<string, unknown> {
  if (!text.trim())
    return {}
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : {}
  }
  catch {
    return {}
  }
}

async function loadPdf() {
  pdfUrl.value = null
  const base = `/api/assignments/${props.assignmentId}`
  for (const query of [`?problem=${props.problemId}`, '']) {
    const check = await $fetch<{ status: boolean }>(`${base}/pdf-check${query}`).catch(() => ({ status: false }))
    if (check.status) {
      pdfUrl.value = `${base}/pdf${query}`
      return
    }
  }
}

function payload(mode: 'save' | 'submit' | 'execute') {
  return {
    mode,
    problemId: props.problemId,
    language: props.language,
    code: editor!.getValue(),
    input: input.value,
    recording: recorder!.stringify(),
    metrics: recorder!.calcMetrics(),
  }
}

async function act(mode: 'save' | 'submit' | 'execute') {
  if (!editor || !recorder || !canRun.value)
    return
  busy.value = true
  recorder.action(mode)
  try {
    const res = await $fetch<{ status: boolean, message: string }>('/api/submit/editor', { method: 'POST', body: payload(mode) })
    status.value = res.message
    if (!res.status) {
      toast.add({ title: res.message, color: 'error', icon: 'i-lucide-circle-alert' })
      return
    }
    if (mode === 'submit') {
      recorder.stop()
      toast.add({ title: 'Submitted', description: 'Your code is in the judge queue.', color: 'success', icon: 'i-lucide-check' })
      await navigateTo('/submissions/all')
    }
    else if (mode === 'execute') {
      await pollOutput()
    }
  }
  catch (e) {
    status.value = apiError(e).message
    toast.add({ title: status.value, color: 'error' })
  }
  finally {
    busy.value = false
  }
}

async function pollOutput() {
  running.value = true
  const runInput = input.value
  try {
    for (let i = 0; i < 300; i++) {
      const res = await $fetch<{ status: boolean, content: string }>(`/api/submit/editor/${props.problemId}/output`)
      if (res.content !== output.value) {
        output.value = res.content
        recorder?.outputChanged(res.content)
      }
      if (res.status) {
        status.value = 'Completed'
        return
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    status.value = 'Still running…'
  }
  finally {
    running.value = false
    void runInput
  }
}

function onInput(value: string) {
  input.value = value
  recorder?.inputChanged(value)
}
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3" :class="pdfUrl && showPdf ? 'xl:grid-cols-2' : ''">
      <div class="rounded-lg border border-default overflow-hidden">
        <div class="flex items-center justify-between gap-2 px-3 py-1.5 bg-elevated/50 border-b border-default text-xs text-muted">
          <span class="flex items-center gap-1.5"><UIcon name="i-lucide-code-xml" /> Code</span>
          <UButton
            v-if="pdfUrl"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="showPdf ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
            :label="showPdf ? 'Hide PDF' : 'Show PDF'"
            @click="showPdf = !showPdf"
          />
        </div>
        <div ref="host" class="h-[28rem] lg:h-[34rem] w-full" />
      </div>
      <div v-if="pdfUrl && showPdf" class="rounded-lg border border-default overflow-hidden min-h-[28rem]">
        <iframe ref="pdfFrame" :src="pdfUrl" title="Problem PDF" class="w-full h-full min-h-[28rem] lg:min-h-[36rem] bg-white" />
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <UFormField label="Input" help="Used by Run">
        <UTextarea
          :model-value="input"
          :rows="6"
          :disabled="!canRun || isTxt"
          class="w-full font-mono"
          :ui="{ base: 'font-mono text-sm' }"
          @update:model-value="onInput(String($event))"
        />
      </UFormField>
      <UFormField label="Output">
        <UTextarea
          :model-value="output"
          :rows="6"
          readonly
          class="w-full"
          :ui="{ base: 'font-mono text-sm bg-elevated/40' }"
          placeholder="Run your code to see the output"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton icon="i-lucide-save" color="neutral" variant="outline" label="Save" :disabled="!canRun" :loading="busy && !running" @click="act('save')" />
      <UButton icon="i-lucide-play" color="neutral" variant="subtle" label="Run" :disabled="!canRun || isTxt" :loading="running" @click="act('execute')" />
      <UButton icon="i-lucide-send" label="Submit" :disabled="!canRun" @click="act('submit')" />
      <span class="text-sm text-muted ms-1">{{ status }}</span>
    </div>
  </div>
</template>
