<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { h } from 'vue'

interface AssignmentMessage {
  type: 'success' | 'notice' | 'error'
  text: string
}

interface AssignmentRow {
  id: number
  name: string
  problems: number
  totalSubmits: number
  startTime: string
  finishTime: string
  extraTime: number
  open: boolean
  scoreboard: boolean
  archived: boolean
  coefficient: string
  finished: boolean
  /** null: no PDF, 'ok': can open, otherwise the reason it is locked. */
  pdf: string | null
}

const { me, level, refresh: refreshMe } = useMe()
const toast = useToast()
const { data: rows, status, refresh } = await useFetch<AssignmentRow[]>('/api/assignments', { default: () => [] })

// Messages from the add/edit form (legacy showed them on this page after saving).
const messages = useState<AssignmentMessage[]>('assignment-messages', () => [])
const shownMessages = ref<AssignmentMessage[]>([...messages.value])
onMounted(() => (messages.value = []))

const selectedId = computed(() => me.value?.selectedAssignment.id ?? 0)
const selecting = ref<number | null>(null)

async function select(id: number) {
  if (id === selectedId.value)
    return
  selecting.value = id
  try {
    await $fetch('/api/assignments/select', { method: 'POST', body: { id } })
    await refreshMe()
    await refreshNuxtData()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    selecting.value = null
  }
}

// Columns without a visible title still get a label for screen readers; an empty
// string header also renders differently on the server and breaks hydration.
const srOnly = (label: string) => () => h('span', { class: 'sr-only' }, label)

const columns: TableColumn<AssignmentRow>[] = [
  { id: 'select', header: srOnly('Select') },
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'problems', header: 'Problems' },
  { accessorKey: 'totalSubmits', header: 'Submissions' },
  { accessorKey: 'coefficient', header: 'Coefficient' },
  { accessorKey: 'startTime', header: 'Start' },
  { accessorKey: 'finishTime', header: 'Finish' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: srOnly('Actions') },
]

function staffItems(row: AssignmentRow): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = []
  if (level.value >= 2) {
    groups.push([
      { label: 'Edit', icon: 'i-lucide-pencil', to: `/assignments/${row.id}/edit` },
      { label: 'Cheat detection', icon: 'i-lucide-scan-search', to: `/cheat/${row.id}` },
    ])
  }
  const downloads: DropdownMenuItem[] = []
  if (level.value >= 2)
    downloads.push({ label: 'Tests and descriptions', icon: 'i-lucide-file-archive', to: `/api/assignments/${row.id}/download-tests`, external: true, target: '_blank' })
  downloads.push(
    { label: 'Final submissions (by user)', icon: 'i-lucide-download', to: `/api/assignments/${row.id}/download-submissions?type=by_user`, external: true, target: '_blank' },
    { label: 'Final submissions (by problem)', icon: 'i-lucide-download', to: `/api/assignments/${row.id}/download-submissions?type=by_problem`, external: true, target: '_blank' },
  )
  groups.push(downloads)
  if (level.value >= 2)
    groups.push([{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => (toDelete.value = row) }])
  return groups
}

// Delete
const toDelete = ref<AssignmentRow | null>(null)
const deleteOpen = computed({
  get: () => toDelete.value !== null,
  set: (v: boolean) => {
    if (!v)
      toDelete.value = null
  },
})
const deleting = ref(false)
async function confirmDelete() {
  if (!toDelete.value)
    return
  deleting.value = true
  try {
    await $fetch(`/api/assignments/${toDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: `Assignment "${toDelete.value.name}" deleted.`, color: 'success', icon: 'i-lucide-check' })
    toDelete.value = null
    await refreshMe()
    await refreshNuxtData()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    deleting.value = false
  }
}

const messageColor = { success: 'success', notice: 'warning', error: 'error' } as const
const messageIcon = { success: 'i-lucide-circle-check', notice: 'i-lucide-info', error: 'i-lucide-circle-alert' } as const
</script>

<template>
  <AppPage title="Assignments" icon="i-lucide-folder-open">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">
          {{ rows.length }} assignment{{ rows.length === 1 ? '' : 's' }}. Select one to work on it across the judge.
        </p>
        <UButton v-if="level >= 2" to="/assignments/add" icon="i-lucide-plus" label="Add assignment" />
      </div>

      <div v-if="shownMessages.length" class="space-y-2">
        <UAlert
          v-for="(m, i) in shownMessages"
          :key="i"
          :color="messageColor[m.type]"
          :icon="messageIcon[m.type]"
          variant="subtle"
          :title="m.text"
          :close="{ color: 'neutral', variant: 'link' }"
          @update:open="shownMessages.splice(i, 1)"
        />
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          :data="rows"
          :columns="columns"
          :loading="status === 'pending'"
          empty="Nothing to show..."
          class="w-full"
          :meta="{ class: { tr: (row) => row.original.id === selectedId ? 'bg-primary/10' : '' } }"
        >
          <template #select-cell="{ row }">
            <UTooltip :text="row.original.id === selectedId ? 'Selected' : 'Select this assignment'">
              <UButton
                :icon="row.original.id === selectedId ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                :color="row.original.id === selectedId ? 'primary' : 'neutral'"
                variant="ghost"
                size="sm"
                :loading="selecting === row.original.id"
                :aria-label="`Select assignment ${row.original.name}`"
                @click="select(row.original.id)"
              />
            </UTooltip>
          </template>

          <template #name-cell="{ row }">
            <div class="flex items-center gap-2 min-w-40">
              <span dir="auto" class="font-medium" :class="row.original.id === selectedId ? 'text-primary' : ''">{{ row.original.name }}</span>
              <UBadge v-if="row.original.archived" label="Archived" color="neutral" variant="subtle" size="sm" />
            </div>
          </template>

          <template #problems-cell="{ row }">
            <ULink :to="`/problems/${row.original.id}`" class="text-primary whitespace-nowrap">
              {{ row.original.problems }} problem{{ row.original.problems === 1 ? '' : 's' }}
            </ULink>
          </template>

          <template #totalSubmits-cell="{ row }">
            <span class="whitespace-nowrap">{{ row.original.totalSubmits }}</span>
          </template>

          <template #coefficient-cell="{ row }">
            <UBadge v-if="row.original.finished" label="Finished" color="error" variant="subtle" />
            <UTooltip v-else-if="row.original.coefficient === 'error'" text="The coefficient rule of this assignment is invalid.">
              <UBadge label="error" color="error" variant="solid" icon="i-lucide-triangle-alert" />
            </UTooltip>
            <span v-else class="font-mono whitespace-nowrap">{{ row.original.coefficient }} %</span>
          </template>

          <template #startTime-cell="{ row }">
            <span class="whitespace-nowrap">{{ formatDateTime(row.original.startTime) }}</span>
          </template>
          <template #finishTime-cell="{ row }">
            <span class="whitespace-nowrap">{{ formatDateTime(row.original.finishTime) }}</span>
          </template>

          <template #status-cell="{ row }">
            <div class="flex gap-1">
              <UBadge :label="row.original.open ? 'Open' : 'Closed'" :color="row.original.open ? 'success' : 'error'" variant="subtle" />
              <UBadge v-if="row.original.scoreboard" label="Scoreboard" color="info" variant="subtle" icon="i-lucide-trophy" />
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UTooltip v-if="row.original.pdf" :text="row.original.pdf === 'ok' ? 'Assignment PDF' : row.original.pdf">
                <UButton
                  icon="i-lucide-file-text"
                  label="PDF"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  :disabled="row.original.pdf !== 'ok'"
                  :to="row.original.pdf === 'ok' ? `/api/assignments/${row.original.id}/pdf` : undefined"
                  external
                  target="_blank"
                />
              </UTooltip>
              <UButton icon="i-lucide-list" size="sm" color="neutral" variant="ghost" :to="`/problems/${row.original.id}`" aria-label="View problems" />
              <UDropdownMenu v-if="level >= 1" :items="staffItems(row.original)" :content="{ align: 'end' }">
                <UButton icon="i-lucide-ellipsis-vertical" size="sm" color="neutral" variant="ghost" aria-label="More actions" />
              </UDropdownMenu>
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <UModal v-model:open="deleteOpen" title="Delete assignment" :description="toDelete ? `#${toDelete.id} · ${toDelete.name}` : ''">
      <template #body>
        <div class="space-y-2 text-sm">
          <p>Are you sure you want to delete <strong dir="auto">{{ toDelete?.name }}</strong>?</p>
          <p class="text-muted">
            All test cases, submission results and submitted files will be deleted.
            You may want to keep a backup of this assignment before deleting.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" label="Do not delete" @click="toDelete = null" />
          <UButton color="error" icon="i-lucide-trash-2" label="Delete this assignment" :loading="deleting" @click="confirmDelete" />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
