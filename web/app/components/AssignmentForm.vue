<script setup lang="ts">
import type { Form } from '@nuxt/ui'
import { allLanguages, defaultProblemLanguages, judgedLanguages } from '#shared/languages'

export interface AssignmentProblemState {
  name: string
  score: number
  cTimeLimit: number
  pythonTimeLimit: number
  javaTimeLimit: number
  memoryLimit: number
  languages: string[]
  diffCmd: string
  diffArg: string
  isUploadOnly: boolean
}

export interface AssignmentFormData {
  id: number
  name: string
  startTime: string
  finishTime: string
  extraTime: string
  participants: string
  lateRule: string
  open: boolean
  scoreboard: boolean
  javaexceptions: boolean
  archived: boolean
  problems: AssignmentProblemState[]
  hasPdf: boolean
  defaultLateRule: string
  /** Python 2 can be offered only when it is enabled in Settings. */
  python2Enabled?: boolean
  /** Languages this judge cannot run (Python 2 while disabled, Swift when not installed). */
  unavailableLanguages?: string[]
}

const props = defineProps<{ initial: AssignmentFormData }>()

const edit = computed(() => props.initial.id > 0)
const unavailable = computed(() => props.initial.unavailableLanguages ?? (props.initial.python2Enabled ? [] : ['Python 2']))
const toast = useToast()
const { refresh: refreshMe } = useMe()

/** Defaults of a new problem row, exactly as the legacy form. */
function newProblem(): AssignmentProblemState {
  return {
    name: 'Problem ',
    score: 100,
    cTimeLimit: 500,
    pythonTimeLimit: 1500,
    javaTimeLimit: 2000,
    memoryLimit: 50000,
    languages: defaultProblemLanguages(unavailable.value),
    diffCmd: 'diff',
    diffArg: '-bB',
    isUploadOnly: false,
  }
}

// datetime-local inputs use "YYYY-MM-DDTHH:MM:SS"; the database uses a space.
const toInput = (v: string) => (v ? v.replace(' ', 'T') : '')

const state = reactive({
  name: props.initial.name,
  startTime: toInput(props.initial.startTime),
  finishTime: toInput(props.initial.finishTime),
  extraTime: props.initial.extraTime,
  participants: props.initial.participants,
  lateRule: props.initial.lateRule,
  open: props.initial.open,
  scoreboard: props.initial.scoreboard,
  javaexceptions: props.initial.javaexceptions,
  archived: props.initial.archived,
  problems: props.initial.problems.length ? props.initial.problems.map(p => ({ ...p, languages: [...p.languages] })) : [newProblem()],
})
const testsZip = ref<File | null>(null)
const pdfFile = ref<File | null>(null)

// Archived assignments get an "always open" schedule, like the legacy form.
let savedSchedule: { startTime: string, finishTime: string, extraTime: string } | null = null
watch(() => state.archived, (archived) => {
  if (archived) {
    savedSchedule = { startTime: state.startTime, finishTime: state.finishTime, extraTime: state.extraTime }
    state.startTime = '1970-01-02T00:00:00'
    state.finishTime = '2038-01-18T00:00:00'
    state.extraTime = '0'
  }
  else {
    state.startTime = savedSchedule?.startTime ?? ''
    state.finishTime = savedSchedule?.finishTime ?? ''
    state.extraTime = savedSchedule?.extraTime ?? ''
    savedSchedule = null
  }
})

const extraTimeHint = computed(() => {
  const parts = state.extraTime.split('*').map(p => p.trim())
  if (!state.extraTime.trim() || parts.some(p => !/^\d+(?:\.\d+)?$/.test(p)))
    return 'Minutes for late submissions, e.g. 30 or 48*60.'
  const minutes = parts.reduce((a, p) => a * Number(p), 1)
  return minutes ? `= ${humanDuration(Math.round(minutes * 60))} after the finish time.` : 'No extra time.'
})

function addProblem() {
  state.problems.push(newProblem())
}
function removeProblem(i: number) {
  if (state.problems.length > 1)
    state.problems.splice(i, 1)
}
function setUploadOnly(p: AssignmentProblemState, value: boolean) {
  p.isUploadOnly = value
  // Judged problems can only keep judged languages (same filter as the server).
  if (!value)
    p.languages = p.languages.filter(l => judgedLanguages().includes(l))
}
const languageItems = (p: AssignmentProblemState) => (p.isUploadOnly ? allLanguages(unavailable.value) : judgedLanguages(unavailable.value))

// Import (add only): fill the form from the assignment.json of an exported zip and upload the
// same zip as tests. Editing is left out on purpose: it could replace problems that already have
// submissions.
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const importing = ref(false)
const importedFrom = ref('')

async function importZip(file: File) {
  importing.value = true
  try {
    const { unzipSync, strFromU8 } = await import('fflate')
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: f => f.name === 'assignment.json' })
    const json = entries['assignment.json']
    if (!json)
      throw new Error('This zip has no assignment.json. Export the assignment again from the Assignments page, or upload it below as tests only.')
    const meta = JSON.parse(strFromU8(json)) as Partial<AssignmentFormData> & { format?: number }
    if (meta.format !== 1 || !Array.isArray(meta.problems) || !meta.problems.length)
      throw new Error('assignment.json has an unknown format.')
    state.archived = false
    await nextTick() // let the archived watcher run before the schedule is set
    Object.assign(state, {
      name: String(meta.name ?? ''),
      // The old schedule has almost certainly passed, and last term's participants and the
      // open flag do not apply: set them again before saving.
      startTime: '',
      finishTime: '',
      extraTime: String(meta.extraTime ?? '0'),
      participants: 'ALL',
      lateRule: String(meta.lateRule || props.initial.defaultLateRule),
      open: false,
      scoreboard: Boolean(meta.scoreboard),
      javaexceptions: Boolean(meta.javaexceptions),
      problems: meta.problems.map((p) => {
        const row = { ...newProblem(), ...p, isUploadOnly: Boolean(p.isUploadOnly) }
        const allowed = row.isUploadOnly ? allLanguages(unavailable.value) : judgedLanguages(unavailable.value)
        return { ...row, languages: (Array.isArray(p.languages) ? p.languages : []).filter(l => allowed.includes(l)) }
      }),
    })
    testsZip.value = file
    importedFrom.value = file.name
    toast.add({
      title: `Imported ${state.problems.length} problem${state.problems.length > 1 ? 's' : ''}`,
      description: 'Set the start and finish time, check the form, then save.',
      color: 'success',
      icon: 'i-lucide-file-input',
    })
  }
  catch (e) {
    toast.add({ title: 'Import failed', description: (e as Error).message, color: 'error' })
  }
  finally {
    importing.value = false
    if (importInput.value)
      importInput.value.value = ''
  }
}

function onImportPicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file)
    importZip(file)
}

const totalScore = computed(() => state.problems.reduce((s, p) => s + (Number(p.score) || 0), 0))

// Submit
const form = useTemplateRef<Form<typeof state>>('form')
const saving = ref(false)
const error = ref('')
const messages = useState<{ type: 'success' | 'notice' | 'error', text: string }[]>('assignment-messages', () => [])

async function submit() {
  saving.value = true
  error.value = ''
  form.value?.clear()
  const fd = new FormData()
  fd.append('data', JSON.stringify(state))
  if (testsZip.value)
    fd.append('tests_desc', testsZip.value)
  if (pdfFile.value)
    fd.append('pdf', pdfFile.value)
  try {
    const res = await $fetch<{ id: number, messages: typeof messages.value }>(
      edit.value ? `/api/assignments/${props.initial.id}` : '/api/assignments',
      { method: 'POST', body: fd },
    )
    messages.value = res.messages
    const failed = res.messages.filter(m => m.type === 'error').length
    toast.add({
      title: edit.value ? 'Assignment updated' : 'Assignment added',
      description: failed ? `${failed} file problem${failed > 1 ? 's' : ''}, see details.` : undefined,
      color: failed ? 'warning' : 'success',
      icon: 'i-lucide-check',
    })
    await refreshMe()
    await refreshNuxtData('assignment-options')
    await navigateTo('/assignments')
  }
  catch (e) {
    const { message, fields } = apiError(e)
    const fieldErrors = Object.entries(fields).filter(([name]) => name !== '_')
    if (fieldErrors.length) {
      form.value?.setErrors(fieldErrors.map(([name, message]) => ({ name, message })))
      error.value = 'Please fix the highlighted fields.'
      await nextTick()
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    else {
      error.value = message
    }
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UForm ref="form" :state="state" :validate-on="[]" class="space-y-6" @submit="submit">
    <UAlert v-if="edit" icon="i-lucide-info" color="info" variant="subtle" title="If you don't want to change tests or the PDF file, just do not upload its file." />
    <UAlert
      v-else
      icon="i-lucide-file-input"
      color="neutral"
      variant="subtle"
      title="Reuse an assignment"
      :description="importedFrom
        ? `Filled from ${importedFrom}; its tests are uploaded when you save. Schedule, participants and Open were reset.`
        : 'Import a zip exported from the Assignments page (any SharIF Judge installation) to fill this form with its problems, limits and tests.'"
      :actions="[{ label: importedFrom ? 'Import another' : 'Import from export', icon: 'i-lucide-upload', color: 'neutral', variant: 'outline', loading: importing, onClick: () => importInput?.click() }]"
    />
    <input ref="importInput" type="file" accept=".zip,application/zip" class="hidden" aria-label="Import an exported assignment zip" @change="onImportPicked">

    <!-- Details -->
    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-info" class="text-primary" /> Details
        </h2>
      </template>
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Assignment name" name="name" required class="md:col-span-2">
          <UInput v-model="state.name" :maxlength="50" class="w-full" placeholder="e.g. Week 3 – Recursion" />
        </UFormField>
        <UFormField label="Participants" name="participants" description="Comma separated usernames. Only these users can submit. Use ALL for everyone." class="md:col-span-2">
          <UTextarea v-model="state.participants" :rows="3" autoresize class="w-full font-mono" placeholder="ALL" />
        </UFormField>
        <div class="md:col-span-2 grid gap-3 sm:grid-cols-2">
          <USwitch v-model="state.open" label="Open" description="Students can see and submit to this assignment." />
          <USwitch v-model="state.scoreboard" label="Scoreboard" description="Enable the scoreboard." />
          <USwitch v-model="state.javaexceptions" label="Java exceptions" description="Show Java exceptions to users." />
          <USwitch v-model="state.archived" label="Archived" description="Archived assignment (always available schedule)." />
        </div>
      </div>
    </UCard>

    <!-- Schedule & late rule -->
    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-calendar-clock" class="text-primary" /> Schedule &amp; late rule
        </h2>
      </template>
      <div class="grid gap-4 md:grid-cols-3">
        <UFormField label="Start time" name="startTime" required>
          <UInput v-model="state.startTime" type="datetime-local" step="1" class="w-full" />
        </UFormField>
        <UFormField label="Finish time" name="finishTime" required>
          <UInput v-model="state.finishTime" type="datetime-local" step="1" class="w-full" />
        </UFormField>
        <UFormField label="Extra time (minutes)" name="extraTime" required :help="extraTimeHint">
          <UInput v-model="state.extraTime" class="w-full font-mono" placeholder="48*60" />
        </UFormField>
        <UFormField name="lateRule" required class="md:col-span-3">
          <template #label>
            Coefficient rule
          </template>
          <template #description>
            Legacy PHP snippet (without &lt;?php ?&gt;) using <code>$delay</code> and <code>$extra_time</code> (seconds), setting <code>$coefficient</code> (percent).
          </template>
          <template #hint>
            <UButton
              v-if="state.lateRule !== initial.defaultLateRule"
              size="xs"
              variant="link"
              color="neutral"
              icon="i-lucide-rotate-ccw"
              label="Use default"
              @click="state.lateRule = initial.defaultLateRule"
            />
          </template>
          <UTextarea v-model="state.lateRule" :rows="10" autoresize :maxrows="24" class="w-full" :ui="{ base: 'font-mono text-xs leading-relaxed' }" spellcheck="false" />
        </UFormField>
      </div>
    </UCard>

    <!-- Problems -->
    <UCard :ui="{ body: 'space-y-3' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-puzzle" class="text-primary" /> Problems
            <UBadge :label="String(state.problems.length)" variant="subtle" />
            <span class="text-xs font-normal text-muted">Total score {{ totalScore }}</span>
          </h2>
          <UButton icon="i-lucide-plus" label="Add problem" size="sm" variant="soft" @click="addProblem" />
        </div>
      </template>

      <UFormField name="problems" />

      <div v-for="(p, i) in state.problems" :key="i" class="rounded-lg border border-default p-3 space-y-3 bg-elevated/30">
        <div class="flex items-start gap-2">
          <UBadge :label="`#${i + 1}`" color="neutral" variant="solid" class="mt-1.5 shrink-0" />
          <UFormField :name="`problems.${i}.name`" class="flex-1">
            <UInput v-model="p.name" :maxlength="50" placeholder="Problem name" class="w-full" aria-label="Problem name" />
          </UFormField>
          <UTooltip :text="state.problems.length > 1 ? 'Remove problem' : 'An assignment needs at least one problem'">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              :disabled="state.problems.length <= 1"
              :aria-label="`Remove problem ${i + 1}`"
              @click="removeProblem(i)"
            />
          </UTooltip>
        </div>

        <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <UFormField label="Score" :name="`problems.${i}.score`" size="sm">
            <UInput v-model.number="p.score" type="number" class="w-full" />
          </UFormField>
          <UFormField label="C/C++, Go, Swift (ms)" :name="`problems.${i}.cTimeLimit`" size="sm">
            <UInput v-model.number="p.cTimeLimit" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField label="Python (ms)" :name="`problems.${i}.pythonTimeLimit`" size="sm">
            <UInput v-model.number="p.pythonTimeLimit" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField label="Java, Kotlin, JS (ms)" :name="`problems.${i}.javaTimeLimit`" size="sm">
            <UInput v-model.number="p.javaTimeLimit" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField label="Memory (kB)" :name="`problems.${i}.memoryLimit`" size="sm">
            <UInput v-model.number="p.memoryLimit" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField label="Upload only" :name="`problems.${i}.isUploadOnly`" size="sm">
            <div class="h-8 flex items-center">
              <USwitch :model-value="p.isUploadOnly" :aria-label="`Problem ${i + 1} is upload only`" @update:model-value="setUploadOnly(p, $event)" />
            </div>
          </UFormField>
          <UFormField label="Allowed languages" :name="`problems.${i}.languages`" size="sm" class="col-span-2 sm:col-span-3 lg:col-span-4">
            <USelectMenu
              v-model="p.languages"
              :items="languageItems(p)"
              multiple
              :search-input="false"
              placeholder="Select languages"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Diff command" :name="`problems.${i}.diffCmd`" size="sm">
            <UInput v-model="p.diffCmd" :maxlength="20" class="w-full font-mono" />
          </UFormField>
          <UFormField label="Diff argument" :name="`problems.${i}.diffArg`" size="sm">
            <UInput v-model="p.diffArg" :maxlength="20" class="w-full font-mono" />
          </UFormField>
        </div>
      </div>

      <UButton icon="i-lucide-plus" label="Add problem" color="neutral" variant="outline" block class="border-dashed" @click="addProblem" />
    </UCard>

    <!-- Files -->
    <UCard>
      <template #header>
        <h2 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-folder-up" class="text-primary" /> Files
        </h2>
      </template>
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Tests and descriptions (zip)" name="tests_desc">
          <template #description>
            <code>p1/in/input1.txt</code>, <code>p1/out/output1.txt</code>, <code>p1/desc.md</code>, <code>p1/tester.cpp</code>, PDFs… Only txt, cpp, html, md and pdf files are extracted.
          </template>
          <UFileUpload
            v-model="testsZip"
            accept=".zip,application/zip"
            icon="i-lucide-file-archive"
            label="Drop a zip file here"
            :description="edit ? 'Replaces existing tests and descriptions' : 'Optional'"
            layout="list"
            class="w-full min-h-36"
          />
        </UFormField>
        <UFormField label="Assignment PDF" name="pdf">
          <template #description>
            PDF file of the whole assignment.
            <span v-if="initial.hasPdf"> A PDF is already uploaded; a new one replaces it.</span>
          </template>
          <UFileUpload
            v-model="pdfFile"
            accept=".pdf,application/pdf"
            icon="i-lucide-file-text"
            label="Drop a PDF here"
            description="Optional"
            layout="list"
            class="w-full min-h-36"
          />
        </UFormField>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error" />

    <div class="flex flex-wrap justify-end gap-2 sticky bottom-0 py-3 bg-default/90 backdrop-blur border-t border-default">
      <UButton to="/assignments" color="neutral" variant="ghost" label="Cancel" />
      <UButton type="submit" :loading="saving" :icon="edit ? 'i-lucide-save' : 'i-lucide-plus'" :label="edit ? 'Save assignment' : 'Add assignment'" />
    </div>
  </UForm>
</template>
