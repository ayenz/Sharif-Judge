<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const toast = useToast()
const { me } = useMe()
const { data } = await useFetch('/api/submit')
const busy = ref<number | null>(null)
const confirmProblem = ref<{ id: number, name: string } | null>(null)

async function rejudge() {
  const p = confirmProblem.value
  if (!p)
    return
  busy.value = p.id
  try {
    await $fetch('/api/rejudge', { method: 'POST', body: { problemId: p.id } })
    toast.add({ title: `Rejudging problem ${p.id}`, description: 'Follow the progress in the queue.', color: 'success', icon: 'i-lucide-rotate-ccw', actions: [{ label: 'Open queue', to: '/queue' }] })
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error' })
  }
  finally {
    busy.value = null
    confirmProblem.value = null
  }
}
</script>

<template>
  <AppPage title="Rejudge" icon="i-lucide-rotate-ccw">
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Rejudge every submission of a problem in <span class="font-medium text-default">{{ me?.selectedAssignment.name }}</span>.
        Upload-only problems are skipped. To rejudge one submission, use the button in All Submissions.
      </p>
      <UAlert v-if="!me?.selectedAssignment.id" color="warning" variant="subtle" title="No assignment is selected." />
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="p in data?.problems" :key="p.id" class="lift" :ui="{ body: 'p-4 sm:p-4' }">
          <div class="flex items-center gap-3">
            <div class="min-w-0 me-auto">
              <p class="font-medium truncate">
                {{ p.id }}. {{ p.name }}
              </p>
              <p class="text-xs text-muted">
                {{ p.isUploadOnly ? 'Upload only' : p.languages.join(', ') }}
              </p>
            </div>
            <UButton
              icon="i-lucide-rotate-ccw"
              label="Rejudge"
              color="neutral"
              variant="outline"
              :disabled="p.isUploadOnly"
              :loading="busy === p.id"
              @click="confirmProblem = { id: p.id, name: p.name }"
            />
          </div>
        </UCard>
      </div>
    </div>

    <UModal :open="!!confirmProblem" :title="`Rejudge problem ${confirmProblem?.id}?`" description="All its submissions go back to PENDING and are judged again." @update:open="v => !v && (confirmProblem = null)">
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="confirmProblem = null" />
          <UButton label="Rejudge" icon="i-lucide-rotate-ccw" @click="rejudge" />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
