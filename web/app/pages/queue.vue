<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const toast = useToast()
const { data, refresh } = await useFetch('/api/queue')

const live = useLive()
live.on('queue', () => refresh())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => !live.connected.value && document.visibilityState === 'visible' && refresh(), 3000)
})
onBeforeUnmount(() => clearInterval(timer))

const confirmEmpty = ref(false)
async function run(action: 'pause' | 'resume' | 'empty') {
  try {
    await $fetch(`/api/queue/${action}`, { method: 'POST' })
    toast.add({ title: { pause: 'Queue paused after the current item', resume: 'Queue resumed', empty: 'Queue emptied' }[action], color: 'success' })
    confirmEmpty.value = false
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
}
</script>

<template>
  <AppPage title="Submission Queue" icon="i-lucide-list-ordered">
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge :color="data?.working ? 'success' : 'neutral'" variant="subtle" size="lg" :icon="data?.working ? 'i-lucide-loader' : 'i-lucide-pause'">
          {{ data?.working ? 'Judging' : 'Idle' }}
        </UBadge>
        <span class="text-sm text-muted me-auto">{{ data?.items.length ?? 0 }} item(s) waiting</span>
        <UButton color="neutral" variant="outline" icon="i-lucide-pause" label="Pause" @click="run('pause')" />
        <UButton color="neutral" variant="outline" icon="i-lucide-play" label="Resume" @click="run('resume')" />
        <UButton color="error" variant="soft" icon="i-lucide-trash-2" label="Empty queue" :disabled="!data?.items.length" @click="confirmEmpty = true" />
      </div>

      <div class="overflow-x-auto rounded-lg border border-default">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Submit ID</th>
              <th>Username</th>
              <th>Assignment</th>
              <th>Problem</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in data?.items" :key="item.id" :class="i === 0 && data?.working ? 'bg-primary/5' : ''">
              <td class="text-muted">
                {{ i + 1 }}
              </td>
              <td class="tabular-nums">
                {{ item.submitId }}
              </td>
              <td>{{ item.username }}</td>
              <td>{{ item.assignment }}</td>
              <td>{{ item.problem }}</td>
              <td>
                <UBadge color="neutral" variant="soft">
                  {{ item.type }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
        <UEmpty v-if="!data?.items.length" icon="i-lucide-circle-check" title="The queue is empty" class="py-10" />
      </div>
    </div>

    <UModal v-model:open="confirmEmpty" title="Empty the queue?" description="Waiting submissions stay PENDING until they are rejudged.">
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="confirmEmpty = false" />
          <UButton color="error" label="Empty queue" @click="run('empty')" />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
