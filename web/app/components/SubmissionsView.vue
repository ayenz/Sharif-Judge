<script setup lang="ts">
import type { SubmissionRef } from './SubmissionDetailModal.vue'

const props = defineProps<{ view: 'final' | 'all' }>()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { me, level } = useMe()

const query = computed(() => ({
  view: props.view,
  user: typeof route.query.user === 'string' ? route.query.user : undefined,
  problem: route.query.problem ? Number(route.query.problem) : undefined,
  page: route.query.page ? Number(route.query.page) : 1,
}))

const { data, refresh, status } = await useFetch('/api/submissions', { query, key: `submissions-${props.view}` })

type Item = NonNullable<typeof data.value>['items'][number]

// Keep refreshing while anything is still being judged.
const pending = computed(() => data.value?.items.some(i => i.status === 'PENDING') ?? false)
// Results arrive as live events; polling is only the fallback when the connection is down.
const live = useLive()
live.on('judged', (e) => {
  if (e.assignment === me.value?.selectedAssignment.id)
    refresh()
})
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (pending.value && !live.connected.value && document.visibilityState === 'visible')
      refresh()
  }, 3000)
})
onBeforeUnmount(() => clearInterval(timer))

function setFilter(next: { user?: string | null, problem?: number | null }) {
  const q: Record<string, string> = {}
  const user = next.user === undefined ? query.value.user : next.user
  const problem = next.problem === undefined ? query.value.problem : next.problem
  if (user)
    q.user = user
  if (problem)
    q.problem = String(problem)
  router.push({ query: q })
}

const problemItems = computed(() => [
  { label: 'All problems', value: 0 },
  ...(data.value?.problems ?? []).map(p => ({ label: `${p.id}. ${p.name}`, value: p.id })),
])
const problemFilter = computed({
  get: () => query.value.problem ?? 0,
  set: v => setFilter({ problem: v || null }),
})
const userSearch = ref(query.value.user ?? '')
watch(() => query.value.user, u => (userSearch.value = u ?? ''))

const page = computed({
  get: () => data.value?.page ?? 1,
  set: p => router.push({ query: { ...route.query, page: String(p) } }),
})

const excelUrl = computed(() => {
  const params = new URLSearchParams({ view: props.view })
  if (query.value.user)
    params.set('user', query.value.user)
  if (query.value.problem)
    params.set('problem', String(query.value.problem))
  return `/api/submissions/excel?${params}`
})

const finished = computed(() => {
  const a = me.value?.selectedAssignment
  if (!a?.finishTime)
    return false
  return Date.now() + useMe().clockOffset.value > wallClockToMs(a.finishTime) + a.extraTime * 1000
})

// Detail modal
const detailOpen = ref(false)
const detailType = ref<'code' | 'result' | 'log'>('code')
const detailRef = ref<SubmissionRef | null>(null)
function show(item: Item, type: 'code' | 'result' | 'log') {
  detailRef.value = { username: item.username, assignment: item.assignment, problem: item.problem, submitId: item.submitId }
  detailType.value = type
  detailOpen.value = true
}

async function setFinal(item: Item) {
  if (item.isFinal)
    return
  const res = await $fetch<{ done: number, message?: string }>('/api/submissions/select-final', {
    method: 'POST',
    body: { submitId: item.submitId, problem: item.problem, username: item.username },
  }).catch(e => ({ done: 0, message: apiError(e).message }))
  if (res.done) {
    toast.add({ title: `Submission #${item.submitId} is now final`, color: 'success', icon: 'i-lucide-check' })
    await refresh()
  }
  else {
    toast.add({ title: res.message ?? 'Selecting final submission failed', color: 'error' })
  }
}

async function rejudge(item: Item) {
  try {
    await $fetch('/api/rejudge/single', {
      method: 'POST',
      body: { submitId: item.submitId, username: item.username, assignment: item.assignment, problem: item.problem },
    })
    toast.add({ title: `Rejudging #${item.submitId}`, color: 'info', icon: 'i-lucide-rotate-ccw' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
}

function statusColor(item: Item) {
  if (item.status === 'PENDING')
    return 'neutral'
  if (item.status === 'SCORE')
    return item.fullmark ? 'success' : 'error'
  if (item.status === 'Uploaded')
    return 'info'
  return 'warning'
}

const downloadable = (item: Item) => ['zip', 'pdf', 'txt'].includes(item.fileType)
const downloadUrl = (item: Item) => `/api/submissions/download/${item.username}/${item.assignment}/${item.problem}/${item.submitId}`

// In the final view, alternate the background per user (legacy "hl" rows).
const userBand = computed(() => {
  const bands: boolean[] = []
  let last = ''
  let band = false
  for (const item of data.value?.items ?? []) {
    if (item.username !== last)
      band = !band
    last = item.username
    bands.push(band)
  }
  return bands
})
const rowNumber = (i: number) => ((data.value?.page ?? 1) - 1) * (data.value?.perPage ?? 0) + i + 1
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted me-auto">
        {{ view === 'final' ? 'Final' : 'All' }} submissions of
        <span class="font-medium text-default">{{ me?.selectedAssignment.name }}</span>
        <span v-if="data"> · {{ data.total }} total</span>
      </p>
      <form v-if="level > 0" class="flex items-center gap-1" @submit.prevent="setFilter({ user: userSearch.trim() || null })">
        <UInput v-model="userSearch" icon="i-lucide-user-search" placeholder="Filter username" size="sm" class="w-40" />
      </form>
      <USelect v-model="problemFilter" :items="problemItems" size="sm" class="w-44" />
      <UButton v-if="query.user || query.problem" size="sm" color="neutral" variant="ghost" icon="i-lucide-filter-x" label="Clear filters" @click="setFilter({ user: null, problem: null })" />
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-sheet" label="Excel" :to="excelUrl" external />
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="status === 'pending'" aria-label="Refresh" @click="refresh()" />
    </div>

    <UAlert
      v-if="view === 'all' && level === 0"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="finished ? 'This assignment has finished; final submissions can no longer be changed.' : 'Click the circle to choose which submission counts as final.'"
    />

    <div class="overflow-x-auto rounded-lg border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/60 text-xs uppercase tracking-wide text-muted">
          <tr class="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th:not(.text-right)]:text-left [&>th]:whitespace-nowrap">
            <th v-if="view === 'all'" class="w-10">
              Final
            </th>
            <th v-if="level > 0 && view === 'final'">
              #
            </th>
            <th v-if="level > 0">
              ID
            </th>
            <th v-if="level > 0">
              User
            </th>
            <th>Problem</th>
            <th>Submitted</th>
            <th class="text-right">
              Score
            </th>
            <th class="text-right">
              Delay / coef.
            </th>
            <th class="text-right">
              Final
            </th>
            <th>Lang</th>
            <th>Status</th>
            <th class="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(item, i) in data?.items"
            :key="`${item.username}-${item.problem}-${item.submitId}`"
            class="[&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap hover:bg-elevated/40"
            :class="view === 'final' && userBand[i] ? 'bg-elevated/25' : ''"
          >
            <td v-if="view === 'all'">
              <UButton
                :icon="item.isFinal ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                :color="item.isFinal ? 'success' : 'neutral'"
                variant="ghost"
                size="sm"
                :aria-label="item.isFinal ? 'Final submission' : 'Set as final'"
                :disabled="item.isFinal || (level === 0 && finished)"
                @click="setFinal(item)"
              />
            </td>
            <td v-if="level > 0 && view === 'final'" class="text-muted tabular-nums">
              {{ rowNumber(i) }}
            </td>
            <td v-if="level > 0" class="tabular-nums">
              {{ item.submitId }}
            </td>
            <td v-if="level > 0">
              <button class="text-left hover:text-primary" @click="setFilter({ user: item.username })">
                <span class="font-medium">{{ item.username }}</span>
                <span v-if="item.name" class="block text-xs text-muted truncate max-w-40">{{ item.name }}</span>
              </button>
            </td>
            <td>
              <button class="hover:text-primary" :title="item.problemName" @click="setFilter({ problem: item.problem })">
                {{ item.problem }}<span class="text-muted hidden md:inline"> · {{ item.problemName }}</span>
              </button>
            </td>
            <td class="text-muted tabular-nums">
              {{ formatDateTime(item.time) }}
            </td>
            <td class="text-right tabular-nums">
              {{ item.preScore }}
            </td>
            <td class="text-right tabular-nums">
              <span v-if="item.delay > 0" class="text-error text-xs me-1" title="Delay HH:MM">{{ hhmm(item.delay) }}</span>
              <span v-else class="text-muted text-xs me-1">on time</span>
              <span :class="item.coefficient === 'error' ? 'text-error' : ''">{{ item.coefficient }}{{ item.coefficient === 'error' ? '' : '%' }}</span>
            </td>
            <td class="text-right font-semibold tabular-nums">
              {{ item.finalScore }}
            </td>
            <td>
              <UBadge color="neutral" variant="soft" size="sm">
                {{ item.language }}
              </UBadge>
            </td>
            <td>
              <UBadge v-if="item.status === 'Uploaded'" color="info" variant="subtle">
                Uploaded
              </UBadge>
              <UButton
                v-else
                size="xs"
                :color="statusColor(item)"
                :variant="item.status === 'PENDING' ? 'soft' : 'subtle'"
                :loading="item.status === 'PENDING'"
                :label="item.status === 'SCORE' ? String(item.finalScore) : item.status"
                @click="show(item, 'result')"
              />
            </td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <UButton v-if="downloadable(item)" size="xs" color="neutral" variant="ghost" icon="i-lucide-download" label="File" :to="downloadUrl(item)" external />
                <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-code" label="Code" @click="show(item, 'code')" />
                <UButton v-if="level > 0" size="xs" color="neutral" variant="ghost" icon="i-lucide-scroll-text" label="Log" @click="show(item, 'log')" />
                <UButton v-if="level >= 2 && !item.isUploadOnly" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" aria-label="Rejudge" @click="rejudge(item)" />
                <!-- Keeps the columns aligned on rows that cannot be rejudged. -->
                <span v-else-if="level >= 2" class="inline-block w-6 shrink-0" aria-hidden="true" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <UEmpty v-if="data && !data.items.length" icon="i-lucide-inbox" title="No submissions yet" class="py-10" />
    </div>

    <div v-if="data && data.perPage && data.total > data.perPage" class="flex justify-center">
      <UPagination v-model:page="page" :total="data.total" :items-per-page="data.perPage" />
    </div>

    <SubmissionDetailModal v-model:open="detailOpen" :submission="detailRef" :type="detailType" />
  </div>
</template>
