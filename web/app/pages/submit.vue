<script setup lang="ts">
import { ARCHIVE_LANGUAGES } from '#shared/languages'

const route = useRoute()
const toast = useToast()
const { data } = await useFetch('/api/submit')

const problemId = ref<number | undefined>(Number(route.query.problem) || undefined)
const language = ref<string | undefined>()
const tab = ref<'editor' | 'upload'>('editor')

const problem = computed(() => data.value?.problems.find(p => p.id === problemId.value))
const problemItems = computed(() => (data.value?.problems ?? []).map(p => ({
  label: `${p.id}. ${p.name}`,
  value: p.id,
  description: p.isUploadOnly ? 'upload only' : undefined,
})))
const languageItems = computed(() => problem.value?.languages ?? [])

watch(problemId, () => {
  language.value = languageItems.value.length === 1 ? languageItems.value[0] : undefined
  if (problem.value?.isUploadOnly)
    tab.value = 'upload'
}, { immediate: true })
const uploadHint = computed(() => {
  const limit = `File name may contain letters, digits, _ - ( ). Max ${data.value?.fileSizeLimit} KB.`
  if (language.value === 'Java (zip)')
    return `A .zip with your .java files (folders for packages are fine); the class with main is run, or the one named Main. ${limit}`
  if (language.value === 'JAR')
    return `A runnable .jar with Main-Class in its manifest, compiled for Java 17 or older. ${limit}`
  return limit
})

// Java zips and JARs can only be uploaded.
const archive = computed(() => !!language.value && ARCHIVE_LANGUAGES.includes(language.value))
watch(archive, (isArchive) => {
  if (isArchive)
    tab.value = 'upload'
}, { immediate: true })
watch(() => data.value?.problems, () => {
  if (problemId.value && !problem.value)
    problemId.value = undefined
})

const coefficientColor = computed(() => {
  const c = data.value?.coefficient
  if (c === 'error')
    return 'error'
  return Number(c) >= 100 ? 'success' : 'warning'
})

// File upload
const file = ref<File | null>(null)
const uploading = ref(false)
async function upload() {
  if (!problemId.value || !language.value || !file.value)
    return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('problem', String(problemId.value))
    form.append('language', language.value)
    form.append('file', file.value)
    await $fetch('/api/submit', { method: 'POST', body: form })
    toast.add({ title: 'File submitted', description: 'See the result in All Submissions.', color: 'success', icon: 'i-lucide-check' })
    await navigateTo('/submissions/all')
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    uploading.value = false
  }
}

const tabs = computed(() => [
  { label: 'Code editor', value: 'editor', icon: 'i-lucide-square-code', disabled: problem.value?.isUploadOnly || archive.value },
  { label: 'Upload a file', value: 'upload', icon: 'i-lucide-file-up' },
])
</script>

<template>
  <AppPage title="Submit" icon="i-lucide-upload">
    <div class="space-y-5">
      <UAlert
        v-if="data?.blocked"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="data.blocked"
        :actions="data.blocked.includes('select') ? [{ label: 'Choose assignment', to: '/assignments' }] : []"
      />

      <template v-else-if="data">
        <div class="flex flex-wrap items-end gap-3">
          <UFormField label="Problem" class="w-full sm:w-72">
            <USelect v-model="problemId" :items="problemItems" placeholder="Select problem" class="w-full" />
          </UFormField>
          <UFormField label="Language" class="w-full sm:w-48">
            <USelect v-model="language" :items="languageItems" placeholder="Select language" :disabled="!problem" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-2 sm:ms-auto text-sm">
            <span class="text-muted">Late coefficient</span>
            <UBadge :color="coefficientColor" variant="subtle" size="lg">
              {{ data.coefficient === 'error' ? 'error' : `${data.coefficient}%` }}
            </UBadge>
            <UButton v-if="problem" :to="`/problems/${data.assignment.id}/${problem.id}`" icon="i-lucide-file-text" color="neutral" variant="ghost" label="Description" />
          </div>
        </div>

        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" class="w-full" />

        <div v-show="tab === 'editor'">
          <ClientOnly>
            <SubmitEditor :assignment-id="data.assignment.id" :problem-id="problemId" :language="language" />
            <template #fallback>
              <USkeleton class="h-[28rem] w-full" />
            </template>
          </ClientOnly>
        </div>

        <UCard v-if="tab === 'upload'" class="max-w-xl">
          <div class="space-y-4">
            <UFileUpload
              v-model="file"
              label="Drop your file here"
              :description="uploadHint"
              icon="i-lucide-file-code"
              class="w-full min-h-40"
            />
            <div class="flex items-center gap-3">
              <UButton icon="i-lucide-send" label="Submit file" :loading="uploading" :disabled="!problemId || !language || !file" @click="upload" />
              <span v-if="!problemId || !language" class="text-sm text-muted">Choose a problem and language first.</span>
            </div>
          </div>
        </UCard>
      </template>

    </div>
  </AppPage>
</template>
