<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const route = useRoute()
const router = useRouter()
const assignmentId = computed(() => Number(route.params.assignment) || 0)
const problemId = computed(() => Number(route.params.problem) || 0)
const username = computed(() => String(route.params.username ?? ''))

const { data, status, error } = useFetch(
  () => `/api/recordings/${assignmentId.value}/${problemId.value}/${encodeURIComponent(username.value)}`,
  { key: () => `recording-${assignmentId.value}-${problemId.value}-${username.value}` },
)

// Selected recording: ?rec=<id>, defaulting to the first one (oldest upload, like the legacy page).
const recId = computed<number | null>(() => {
  const q = Number(route.query.rec)
  if (typeof route.query.rec === 'string' && Number.isInteger(q) && q >= 0)
    return q
  return data.value?.recordings[0]?.recId ?? null
})
const current = computed(() => data.value?.recordings.find(r => r.recId === recId.value))

const recItems = computed(() => (data.value?.recordings ?? []).map(r => ({
  label: r.recId === 0 ? `Draft · ${formatDateTime(r.uploadAt)}` : `#${r.recId} · ${formatDateTime(r.uploadAt)}`,
  value: r.recId,
})))
const recModel = computed({
  get: () => recId.value ?? undefined,
  set: (v?: number) => router.replace({ query: { ...route.query, rec: v === undefined ? undefined : String(v) } }),
})

const problemItems = computed(() => (data.value?.problems ?? []).map(p => ({ label: `${p.id}. ${p.name}`, value: p.id })))
const problemModel = computed({
  get: () => problemId.value,
  set: (v: number) => navigateTo(`/recordings/${assignmentId.value}/${v}/${username.value}`),
})

const src = computed(() => recId.value === null
  ? ''
  : `/api/recordings/${assignmentId.value}/${problemId.value}/${encodeURIComponent(username.value)}/${recId.value}`)
</script>

<template>
  <AppPage title="Recording" icon="i-lucide-video" wide>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2 min-w-0">
        <UButton to="/recordings" icon="i-lucide-arrow-left" color="neutral" variant="ghost" aria-label="Back to recordings" />
        <div class="min-w-0">
          <p class="font-semibold text-highlighted truncate" dir="auto">
            {{ data?.displayName || username }}
            <span class="font-normal text-muted">· {{ username }}</span>
          </p>
          <p class="text-xs text-muted truncate" dir="auto">
            {{ data?.assignment.name }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <USelect v-if="problemItems.length" v-model="problemModel" :items="problemItems" class="w-44" icon="i-lucide-file-text" />
        <USelect
          v-if="recItems.length"
          v-model="recModel"
          :items="recItems"
          class="w-60"
          icon="i-lucide-history"
        />
        <UButton
          v-if="src"
          :href="withAppBase(src)"
          external
          download
          icon="i-lucide-download"
          color="neutral"
          variant="subtle"
        >
          JSON
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="apiError(error).message" />

    <div v-else-if="status === 'pending' && !data" class="space-y-3">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-96 w-full" />
    </div>

    <div v-else-if="data && !data.recordings.length && recId === null" class="py-16 text-center text-muted">
      <UIcon name="i-lucide-video-off" class="size-10 mb-2 opacity-40" />
      <p>No recordings of {{ username }} for this problem.</p>
    </div>

    <template v-else-if="data">
      <div v-if="current" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        <div v-for="item in [
          { label: 'Duration', value: recordingDuration(current.duration) },
          { label: 'Inserted', value: `${current.inserted} (${current.maxInserted})` },
          { label: 'Removed', value: `${current.removed} (${current.maxRemoved})` },
          { label: 'CCT', value: recordingCct(current.cct) },
          { label: 'Input changes', value: current.totalInputChange },
          { label: 'Executes', value: current.totalExecute },
          { label: 'Nav in / out', value: `${current.totalNavIn} / ${current.totalNavOut}` },
          { label: 'Uploaded', value: formatDateTime(current.uploadAt) },
        ]" :key="item.label" class="rounded-lg border border-default px-3 py-2"
        >
          <p class="text-[11px] text-muted">
            {{ item.label }}
          </p>
          <p class="text-sm font-semibold tabular-nums truncate">
            {{ item.value }}
          </p>
        </div>
      </div>

      <LazyRecordingPlayer v-if="src" :key="src" :src="src" :language="data.language" />
    </template>
  </AppPage>
</template>
