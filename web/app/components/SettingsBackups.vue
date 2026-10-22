<script setup lang="ts">
import type { BackupStatus } from '~~/server/utils/backups'

// Settings > Backups: status of the backup service, "back up now", schedule, stored backups.
const toast = useToast()
const { data, refresh, status } = await useFetch<BackupStatus>('/api/backups', { key: 'backups' })

const schedule = reactive({ time: '', keepDays: 14 })
watch(() => data.value?.schedule, (s) => {
  if (s) {
    schedule.time = s.time
    schedule.keepDays = s.keepDays
  }
}, { immediate: true })

const busy = computed(() => data.value?.last?.status === 'running' || data.value?.runRequested)
// While a backup is requested or running, refresh every few seconds.
let timer: ReturnType<typeof setInterval> | undefined
watch(busy, (on) => {
  clearInterval(timer)
  if (on && import.meta.client)
    timer = setInterval(() => refresh(), 3000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))

const starting = ref(false)
async function runNow() {
  starting.value = true
  try {
    await api('/api/backups/run', { method: 'POST' })
    toast.add({ title: 'Backup requested', description: 'It starts within about 10 seconds.', color: 'info', icon: 'i-lucide-archive' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    starting.value = false
  }
}

const saving = ref(false)
async function saveSchedule() {
  saving.value = true
  try {
    await api('/api/backups/schedule', { method: 'PUT', body: { ...schedule } })
    toast.add({ title: 'Backup schedule saved', color: 'success', icon: 'i-lucide-check' })
    setTimeout(() => refresh(), 15000) // the service picks it up within 10-20 seconds
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
const lastSize = computed(() => {
  const b = data.value?.backups.find(x => x.name === data.value?.last?.folder)
  return b ? size(b.size) : ''
})
const lastColor = computed(() => ({ ok: 'success', failed: 'error', running: 'info' } as const)[data.value?.last?.status ?? 'ok'])
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="data && !data.configured"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="The backup service is not configured"
      description="Backups are made by the backup service of the Docker setup (docker compose up -d backup). See docker/README.md."
    />

    <template v-else-if="data">
      <UCard>
        <div class="flex flex-wrap items-start gap-4">
          <div class="space-y-2 min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <UBadge :color="data.running ? 'success' : 'error'" variant="subtle" :icon="data.running ? 'i-lucide-circle-check' : 'i-lucide-circle-x'">
                {{ data.running ? 'Service running' : 'Service not running' }}
              </UBadge>
              <span v-if="data.schedule" class="text-sm text-muted">Next backup {{ formatDateTime(data.schedule.next) }}</span>
            </div>
            <p v-if="data.last" class="text-sm">
              Last backup:
              <UBadge :color="lastColor" variant="soft" size="sm" :label="data.last.status" />
              <span class="text-muted"> {{ formatDateTime(data.last.time) }}</span>
              <span v-if="data.last.status === 'ok' && lastSize" class="text-muted"> · {{ lastSize }}</span>
              <span v-else-if="data.last.status === 'failed'" class="text-error"> · {{ data.last.message }}</span>
            </p>
            <p v-else class="text-sm text-muted">
              No backup has been made yet.
            </p>
            <p v-if="!data.running" class="text-sm text-muted">
              Start it on the server with <code class="font-mono">docker compose up -d backup</code>.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Refresh" :loading="status === 'pending'" @click="refresh()" />
            <UButton icon="i-lucide-archive" :label="busy ? 'Backing up…' : 'Back up now'" :loading="starting || busy" :disabled="!data.running || busy" @click="runNow" />
          </div>
        </div>
      </UCard>

      <UCard>
        <form class="flex flex-wrap items-end gap-4" @submit.prevent="saveSchedule">
          <UFormField :label="data.schedule ? `Daily at (${data.schedule.timezone})` : 'Daily at'">
            <UInput v-model="schedule.time" type="time" required class="w-32" />
          </UFormField>
          <UFormField label="Keep for">
            <UInput v-model.number="schedule.keepDays" type="number" min="1" max="365" required class="w-28">
              <template #trailing>
                <span class="text-xs text-muted">days</span>
              </template>
            </UInput>
          </UFormField>
          <UButton type="submit" color="neutral" variant="outline" icon="i-lucide-save" label="Save schedule" :loading="saving" :disabled="!data.running" />
        </form>
        <p class="mt-3 text-sm text-muted">
          Each backup holds the database and the assignment files (test cases, descriptions, submitted code).
          Keep copies on another disk or machine too; restoring is done on the server, see docker/README.md.
        </p>
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="px-4 py-3 border-b border-default text-sm font-medium">
          Stored backups ({{ data.backups.length }})
        </div>
        <ul v-if="data.backups.length" class="divide-y divide-default text-sm">
          <li v-for="b in data.backups" :key="b.name" class="flex items-center gap-3 px-4 py-2">
            <UIcon name="i-lucide-archive" class="size-4 text-muted" />
            <span class="font-mono me-auto">{{ b.name }}</span>
            <span class="text-muted tabular-nums">{{ size(b.size) }}</span>
          </li>
        </ul>
        <UEmpty v-else icon="i-lucide-archive" title="No backups yet" class="py-8" />
      </UCard>
    </template>
  </div>
</template>
