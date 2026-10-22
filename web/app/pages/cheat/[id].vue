<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { CheatPair, CheatStudentSignal } from '#shared/cheat'
import type { CheatOverview } from '~/utils/cheat'

definePageMeta({ minLevel: 2 })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id) || 0)

// Follow the assignment switcher: the sidebar link points to the selected assignment.
const { me } = useMe()
watch(() => me.value?.selectedAssignment.id, (selectedId, previous) => {
  if (selectedId && previous !== undefined && selectedId !== id.value)
    navigateTo(`/cheat/${selectedId}`)
})

const { data, refresh, status, error } = useFetch<CheatOverview>(() => `/api/cheat/${id.value}`, {
  key: () => `cheat-${id.value}`,
  immediate: id.value > 0,
})
const { data: students, refresh: refreshStudents, status: studentsStatus } = useLazyFetch<CheatStudentSignal[]>(() => `/api/cheat/${id.value}/students`, {
  key: () => `cheat-students-${id.value}`,
  immediate: id.value > 0,
  server: false,
  default: () => [],
})
const { data: pairs, refresh: refreshPairs, status: pairsStatus } = useLazyFetch<CheatPair[]>(() => `/api/cheat/${id.value}/pairs`, {
  key: () => `cheat-pairs-${id.value}`,
  immediate: id.value > 0,
  server: false,
  default: () => [],
})

const active = computed(() => data.value?.runs.some(r => r.status === 'queued' || r.status === 'running') ?? false)
const analysed = computed(() => data.value?.runs.some(r => r.status === 'done') ?? false)

// Live events report run changes; polling is the fallback while the connection is down.
const live = useLive()
live.on('cheat', (e) => {
  if (e.assignment === id.value)
    refresh()
})

// Poll while runs are queued or running; reload the results once they are finished.
let timer: ReturnType<typeof setInterval> | undefined
function stopPolling() {
  clearInterval(timer)
  timer = undefined
}
function startPolling() {
  if (timer || import.meta.server)
    return
  timer = setInterval(() => {
    if (!active.value)
      return stopPolling()
    if (!live.connected.value && document.visibilityState === 'visible')
      refresh()
  }, 2000)
}
watch(active, (now, before) => {
  if (now)
    startPolling()
  else if (before) {
    refreshStudents()
    refreshPairs()
  }
})
onMounted(() => {
  if (active.value)
    startPolling()
})
onBeforeUnmount(stopPolling)

// Tabs (kept in the URL so "back" from a pair returns to the same tab).
const TAB_VALUES = ['students', 'pairs', 'template', 'moss'] as const
type Tab = typeof TAB_VALUES[number]
const tab = computed<Tab>({
  get: () => TAB_VALUES.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'students',
  set: v => router.replace({ query: { ...route.query, tab: v === 'students' ? undefined : v } }),
})
const highCount = computed(() => students.value.filter(s => s.level === 'high').length)
const tabs = computed<TabsItem[]>(() => [
  { label: 'Students', icon: 'i-lucide-users', value: 'students', badge: highCount.value ? { label: String(highCount.value), color: 'error', variant: 'subtle' } : undefined },
  { label: 'Similar pairs', icon: 'i-lucide-git-compare', value: 'pairs' },
  { label: 'Template code', icon: 'i-lucide-file-code', value: 'template' },
  { label: 'Moss (legacy)', icon: 'i-lucide-cloud', value: 'moss' },
])

const runOpen = ref(false)
function onQueued() {
  refresh().then(() => startPolling())
}
</script>

<template>
  <AppPage title="Cheat Detection" icon="i-lucide-scan-search">
    <UAlert
      v-if="!id"
      icon="i-lucide-folder-x"
      color="neutral"
      variant="subtle"
      title="No assignment is selected"
      description="Pick an assignment from the selector at the top."
    />

    <div v-else-if="!data && status === 'pending'" class="space-y-4">
      <USkeleton class="h-16 w-full" />
      <div class="grid gap-2 sm:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-16" />
      </div>
      <USkeleton class="h-64 w-full" />
    </div>

    <UAlert
      v-else-if="error || !data"
      icon="i-lucide-circle-alert"
      color="error"
      variant="subtle"
      :title="error ? apiError(error).message : 'Could not load this page.'"
    >
      <template #actions>
        <UButton size="xs" color="neutral" variant="outline" label="Retry" @click="refresh()" />
      </template>
    </UAlert>

    <div v-else class="space-y-5">
      <div class="flex flex-wrap items-start gap-3">
        <div class="min-w-0 me-auto">
          <p class="text-xs uppercase tracking-wide text-muted">
            Assignment
          </p>
          <h2 class="text-lg font-semibold text-highlighted truncate" dir="auto">
            {{ data.assignment.name }}
          </h2>
          <p class="text-sm text-muted">
            Compares final submissions per problem and language with JPlag, together with editor recording signals.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton to="/cheat/history" color="neutral" variant="outline" icon="i-lucide-history" label="History" class="hidden sm:inline-flex" />
          <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Refresh" :loading="status === 'pending'" @click="refresh(); refreshStudents(); refreshPairs()" />
          <UButton
            icon="i-lucide-scan-search"
            label="Run analysis"
            :loading="active"
            :disabled="!data.engineAvailable"
            @click="runOpen = true"
          />
        </div>
      </div>

      <UAlert
        v-if="!data.engineAvailable"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The JPlag engine is not installed on this server"
        description="Code similarity cannot be analysed until an administrator installs it. Editor recording indicators and the Moss (legacy) tab still work."
      />

      <section v-if="data.runs.length" aria-label="Analysis runs" class="space-y-2">
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-activity" class="size-3.5" />
          <span>Latest analysis per problem and language</span>
          <span v-if="active" class="inline-flex items-center gap-1 text-primary">
            <span class="size-1.5 rounded-full bg-primary animate-pulse" /> updating
          </span>
        </div>
        <CheatRunStrip :overview="data" />
      </section>
      <div v-else class="rounded-lg border border-dashed border-default px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <UIcon name="i-lucide-scan-search" class="size-8 text-primary/70 shrink-0" />
        <div class="text-sm me-auto">
          <p class="font-medium text-highlighted">
            No analysis has been run yet
          </p>
          <p class="text-muted">
            Students already show editor recording indicators below. Run an analysis to add code similarity.
          </p>
        </div>
        <UButton v-if="data.engineAvailable" variant="soft" icon="i-lucide-play" label="Run analysis" @click="runOpen = true" />
      </div>

      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" class="w-full" :ui="{ list: 'tabs-scroll' }" />

      <Transition name="cheat-tab" mode="out-in">
        <CheatStudentsTable
          v-if="tab === 'students'"
          :signals="students"
          :problems="data.problems"
          :loading="studentsStatus === 'pending' || studentsStatus === 'idle'"
          :analysed="analysed"
        />
        <CheatPairsTable
          v-else-if="tab === 'pairs'"
          :pairs="pairs"
          :problems="data.problems"
          :loading="pairsStatus === 'pending' || pairsStatus === 'idle'"
          :analysed="analysed"
        />
        <CheatBaseCode
          v-else-if="tab === 'template'"
          :assignment-id="data.assignment.id"
          :problems="data.problems"
          @saved="refresh()"
        />
        <CheatMoss
          v-else
          :assignment-id="data.assignment.id"
          :moss="data.moss"
          :update-time="data.assignment.mossUpdate"
          @refresh="refresh()"
        />
      </Transition>
    </div>

    <CheatRunDialog v-if="data" v-model:open="runOpen" :overview="data" @queued="onQueued" @open-templates="tab = 'template'" />
  </AppPage>
</template>

<style scoped>
.cheat-tab-enter-active, .cheat-tab-leave-active { transition: opacity .14s ease, transform .18s var(--ease-out-soft); }
.cheat-tab-enter-from { opacity: 0; transform: translateY(4px); }
.cheat-tab-leave-to { opacity: 0; }
</style>
