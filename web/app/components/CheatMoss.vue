<script setup lang="ts">
import type { CheatOverview } from '~/utils/cheat'

const props = defineProps<{ assignmentId: number, moss: CheatOverview['moss'], updateTime: string }>()
const emit = defineEmits<{ refresh: [] }>()
const toast = useToast()

const state = reactive({ mossUserId: '' })
watch(() => props.moss.userId, v => (state.mossUserId = v ?? ''), { immediate: true })
const { submit, loading: saving, error: saveError } = useApiForm(() => `/api/moss/${props.assignmentId}/userid`, state, {
  successToast: 'Moss user id saved',
  onSuccess: () => emit('refresh'),
})

const detecting = ref(false)
async function detect() {
  detecting.value = true
  try {
    await api(`/api/moss/${props.assignmentId}/detect`, { method: 'POST' })
    toast.add({ title: 'Moss finished', description: 'The result links are below.', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    detecting.value = false
    emit('refresh')
  }
}

const busy = computed(() => detecting.value || props.moss.running)
const links = computed(() => props.moss.links.map(p => ({ ...p, urls: cheatMossLinks(p.link) })))
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-cloud-upload"
      title="Moss sends code to Stanford's server"
      description="Moss (Measure Of Software Similarity) is an external service: submissions are uploaded to Stanford, and the result links expire after about 14 days. JPlag, used by the other tabs, runs entirely on this server."
    />

    <div class="grid gap-4 lg:grid-cols-5">
      <UCard class="lg:col-span-2">
        <template #header>
          <h3 class="font-semibold">
            Moss user id
          </h3>
        </template>
        <UAlert
          v-if="!moss.userId"
          class="mb-3"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="You have not entered your Moss user id."
        />
        <p class="text-sm text-muted mb-3">
          Register on
          <a href="http://theory.stanford.edu/~aiken/moss/" target="_blank" rel="noopener" class="text-primary hover:underline">the Moss website</a>,
          then copy the user id from the script Moss emails you.
        </p>
        <UForm ref="form" :state="state" class="flex flex-col sm:flex-row gap-2 sm:items-start" @submit="submit">
          <UFormField name="mossUserId" class="flex-1">
            <UInput v-model="state.mossUserId" placeholder="e.g. 123456789" inputmode="numeric" class="w-full" />
          </UFormField>
          <UButton type="submit" :loading="saving" icon="i-lucide-save" label="Save" />
        </UForm>
        <p v-if="saveError" class="text-sm text-error mt-2">
          {{ saveError }}
        </p>
      </UCard>

      <UCard class="lg:col-span-3" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-semibold">
                Results
              </h3>
              <p class="text-xs text-muted">
                Last update: {{ updateTime && updateTime !== 'Never' ? formatDateTime(updateTime) : 'Never' }}
              </p>
            </div>
            <UButton
              icon="i-lucide-send"
              color="neutral"
              variant="outline"
              :loading="busy"
              :disabled="busy || !moss.userId"
              :label="busy ? 'Waiting for Moss…' : 'Send to Moss'"
              @click="detect"
            />
          </div>
          <UProgress v-if="busy" animation="carousel" class="mt-3" size="xs" />
          <p v-if="busy" class="text-xs text-muted mt-2">
            This can take a few minutes, please keep this page open.
          </p>
        </template>
        <ul class="divide-y divide-default">
          <li v-for="p in links" :key="p.id" class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 px-4 py-3">
            <span class="text-sm font-medium sm:w-44 shrink-0 truncate" dir="auto">{{ p.id }}. {{ p.name }}</span>
            <div v-if="p.urls.length" class="flex flex-col gap-1 min-w-0">
              <a
                v-for="u in p.urls"
                :key="u.url"
                :href="u.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary hover:underline break-all inline-flex items-center gap-1"
              >
                <UBadge v-if="u.label" size="sm" color="neutral" variant="soft" :label="u.label" class="shrink-0" />
                <span class="break-all">{{ u.url }}</span>
                <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0" />
              </a>
            </div>
            <span v-else-if="p.link" class="text-sm text-warning">No link found. The user id may be wrong.</span>
            <span v-else class="text-sm text-muted">Not sent yet.</span>
          </li>
          <li v-if="!links.length" class="px-4 py-6 text-center text-sm text-muted">
            This assignment has no problems.
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
