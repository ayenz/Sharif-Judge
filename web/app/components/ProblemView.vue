<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'

interface ProblemPage {
  assignment: { id: number, name: string, open: boolean, startTime: string, finishTime: string, extraTime: number }
  problems: { id: number, name: string, score: number, isUploadOnly: boolean }[]
  problem: {
    id: number
    name: string
    score: number
    isUploadOnly: boolean
    cTimeLimit: number
    pythonTimeLimit: number
    javaTimeLimit: number
    memoryLimit: number
    allowedLanguages: string[]
    description: string | null
    hasPdf: boolean
    pdfBlockedReason: string | null
  }
  canSubmit: boolean
  blockedReason: string | null
}

const props = defineProps<{ assignmentId: number, problemId: number }>()

const { me, level, refresh: refreshMe } = useMe()
const toast = useToast()
const { data, error, status } = await useFetch<ProblemPage>(() => `/api/problems/${props.assignmentId}/${props.problemId}`)

useHead({ title: () => (data.value ? `${data.value.problem.name} · Problems` : 'Problems') })

const isSelected = computed(() => me.value?.selectedAssignment.id === props.assignmentId)
const pdfUrl = computed(() => `/api/assignments/${props.assignmentId}/pdf?problem=${props.problemId}`)
const canViewPdf = computed(() => Boolean(data.value?.problem.hasPdf && !data.value.problem.pdfBlockedReason))

const tab = ref('description')
watch(() => props.problemId, () => (tab.value = 'description'))
const tabs = computed<TabsItem[]>(() => {
  const items: TabsItem[] = [{ label: 'Description', icon: 'i-lucide-file-text', value: 'description' }]
  if (data.value?.problem.hasPdf)
    items.push({ label: 'PDF', icon: 'i-lucide-file-type', value: 'pdf', disabled: !canViewPdf.value })
  return items
})

const editItems = computed<DropdownMenuItem[]>(() => [
  { label: 'Edit Markdown', icon: 'i-lucide-file-pen', to: `/problems/${props.assignmentId}/${props.problemId}/edit?type=md` },
  { label: 'Edit HTML (rich text)', icon: 'i-lucide-pen-line', to: `/problems/${props.assignmentId}/${props.problemId}/edit?type=html` },
  { label: 'Edit plain HTML', icon: 'i-lucide-code', to: `/problems/${props.assignmentId}/${props.problemId}/edit?type=plain` },
])

const limits = computed(() => {
  const p = data.value?.problem
  if (!p)
    return []
  return [
    { label: 'C/C++, Go', value: `${p.cTimeLimit} ms` },
    { label: 'Python', value: `${p.pythonTimeLimit} ms` },
    { label: 'Java, JavaScript', value: `${p.javaTimeLimit} ms` },
    { label: 'Memory', value: `${p.memoryLimit.toLocaleString('en')} kB` },
  ]
})

const selecting = ref(false)
async function selectAndSubmit() {
  selecting.value = true
  try {
    await $fetch('/api/assignments/select', { method: 'POST', body: { id: props.assignmentId } })
    await refreshMe()
    await refreshNuxtData()
    await navigateTo(`/submit?problem=${props.problemId}`)
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    selecting.value = false
  }
}
</script>

<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="error.statusCode === 404 ? 'Problem not found.' : apiError(error).message">
      <template #actions>
        <UButton to="/assignments" size="sm" variant="outline" color="neutral" label="Go to assignments" />
      </template>
    </UAlert>

    <div v-else-if="data" class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm text-muted truncate" dir="auto">
            <ULink to="/assignments" class="hover:text-default">{{ data.assignment.name }}</ULink>
          </p>
          <h1 class="text-xl font-semibold flex items-center gap-2" dir="auto">
            <span class="text-muted">{{ data.problem.id }}.</span> {{ data.problem.name }}
          </h1>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="canViewPdf"
            :to="`${pdfUrl}&download=1`"
            external
            icon="i-lucide-download"
            label="PDF"
            color="neutral"
            variant="outline"
          />
          <UDropdownMenu v-if="level >= 2" :items="editItems" :content="{ align: 'end' }">
            <UButton icon="i-lucide-pencil" label="Edit description" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down" />
          </UDropdownMenu>
        </div>
      </div>

      <!-- Problem switcher (phones) -->
      <div class="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <UButton
          v-for="p in data.problems"
          :key="p.id"
          :to="`/problems/${data.assignment.id}/${p.id}`"
          :label="`${p.id}. ${p.name}`"
          size="sm"
          :color="p.id === data.problem.id ? 'primary' : 'neutral'"
          :variant="p.id === data.problem.id ? 'solid' : 'outline'"
          class="shrink-0"
        />
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <!-- Main -->
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <UTabs v-if="tabs.length > 1" v-model="tab" :items="tabs" variant="link" class="px-4 pt-2" :content="false" />
          <div v-show="tab === 'description'" class="p-4 sm:p-6" :class="{ 'opacity-60': status === 'pending' }">
            <!-- Descriptions are instructor-written HTML, shown as-is like the legacy app. -->
            <div v-if="data.problem.description !== null" class="prose-content" dir="auto" v-html="data.problem.description" />
            <UEmpty v-else icon="i-lucide-file-question" title="Description not found" :description="level >= 2 ? 'Upload a zip with desc.md / desc.html or write one now.' : undefined" />
          </div>
          <div v-if="tab === 'pdf' && canViewPdf" class="p-2">
            <iframe :src="pdfUrl" :title="`PDF of ${data.problem.name}`" class="w-full h-[80vh] rounded-md border border-default bg-white" />
          </div>
          <div v-if="data.problem.hasPdf && !canViewPdf" class="px-4 pb-4">
            <UAlert icon="i-lucide-lock" color="neutral" variant="subtle" :title="`PDF unavailable: ${data.problem.pdfBlockedReason}`" />
          </div>
        </UCard>

        <!-- Sidebar -->
        <div class="space-y-4">
          <UCard :ui="{ body: 'space-y-4' }">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-muted text-xs">
                  Score
                </p>
                <p class="font-semibold text-lg">
                  {{ data.problem.score }}
                </p>
              </div>
              <div>
                <p class="text-muted text-xs">
                  Type
                </p>
                <p class="font-medium">
                  {{ data.problem.isUploadOnly ? 'Upload only' : 'Judged' }}
                </p>
              </div>
              <div v-for="l in (data.problem.isUploadOnly ? [] : limits)" :key="l.label">
                <p class="text-muted text-xs">
                  {{ l.label }}
                </p>
                <p class="font-mono">
                  {{ l.value }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-muted text-xs mb-1.5">
                Allowed languages
              </p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="lang in data.problem.allowedLanguages" :key="lang" :label="lang" variant="subtle" />
                <span v-if="!data.problem.allowedLanguages.length" class="text-sm text-muted">None</span>
              </div>
            </div>
            <template v-if="data.canSubmit">
              <UButton v-if="isSelected" :to="`/submit?problem=${data.problem.id}`" icon="i-lucide-upload" label="Submit" block />
              <UButton v-else icon="i-lucide-upload" label="Select assignment & submit" block :loading="selecting" @click="selectAndSubmit" />
            </template>
            <p v-else-if="data.blockedReason" class="text-xs text-muted flex items-center gap-1.5">
              <UIcon name="i-lucide-lock" /> {{ data.blockedReason }}
            </p>
          </UCard>

          <UCard class="hidden lg:block" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'p-2 sm:p-2' }">
            <template #header>
              <p class="text-sm font-medium truncate" dir="auto">
                {{ data.assignment.name }}
              </p>
            </template>
            <p v-if="!data.problems.length" class="text-sm text-muted text-center py-2">
              Nothing to show...
            </p>
            <nav class="flex flex-col">
              <NuxtLink
                v-for="p in data.problems"
                :key="p.id"
                :to="`/problems/${data.assignment.id}/${p.id}`"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-elevated"
                :class="p.id === data.problem.id ? 'bg-primary/10 text-primary font-medium' : ''"
              >
                <span class="w-5 text-right text-muted tabular-nums">{{ p.id }}</span>
                <span class="flex-1 truncate" dir="auto">{{ p.name }}</span>
                <UIcon v-if="p.isUploadOnly" name="i-lucide-paperclip" class="text-muted" />
                <span class="text-xs text-muted tabular-nums">{{ p.score }}</span>
              </NuxtLink>
            </nav>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
