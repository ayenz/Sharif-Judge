<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const route = useRoute()
const toast = useToast()
const id = computed(() => Number(route.params.id) || 0)
const { data, refresh, status } = useFetch(() => `/api/moss/${id.value}`, { key: () => `moss-${id.value}` })

// Follow the assignment switcher: the sidebar link points to the selected assignment.
const { me } = useMe()
watch(() => me.value?.selectedAssignment.id, (selectedId, previous) => {
  if (selectedId && previous !== undefined && selectedId !== id.value)
    navigateTo(`/moss/${selectedId}`)
})

const state = reactive({ mossUserId: '' })
watch(() => data.value?.mossUserId, v => (state.mossUserId = v ?? ''), { immediate: true })
const { submit, loading: saving, error: saveError } = useApiForm(() => `/api/moss/${id.value}/userid`, state, {
  successToast: 'Moss user id saved',
  onSuccess: () => refresh(),
})

const detecting = ref(false)
async function detect() {
  detecting.value = true
  try {
    await $fetch(`/api/moss/${id.value}/detect`, { method: 'POST' })
    toast.add({ title: 'Detection finished', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    detecting.value = false
    await refresh()
  }
}

const isUrl = (link: string | null) => !!link && /^https?:\/\//i.test(link)
const busy = computed(() => detecting.value || Boolean(data.value?.running))
</script>

<template>
  <AppPage title="Detect Similar Codes" icon="i-lucide-scan-search">
    <div v-if="!data && status === 'pending'" class="space-y-3">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <UAlert
      v-else-if="data && !data.assignment.id"
      icon="i-lucide-folder-x"
      color="neutral"
      variant="subtle"
      title="No assignment is selected."
      description="Pick an assignment from the selector at the top."
    />

    <div v-else-if="data" class="grid gap-4 lg:grid-cols-5">
      <div class="space-y-4 lg:col-span-2">
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              What is Moss?
            </h3>
          </template>
          <p class="text-sm text-muted leading-relaxed">
            <a href="http://theory.stanford.edu/~aiken/moss/" target="_blank" rel="noopener" class="text-primary hover:underline">Moss</a>
            (Measure Of Software Similarity) is an automatic system for determining the similarity of programs,
            mainly used to detect plagiarism in programming classes.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-semibold">
              Moss user id
            </h3>
          </template>
          <UAlert
            v-if="!data.mossUserId"
            class="mb-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="You have not entered your Moss user id."
          />
          <p class="text-sm text-muted mb-3">
            Register for Moss on
            <a href="http://theory.stanford.edu/~aiken/moss/" target="_blank" rel="noopener" class="text-primary hover:underline">its website</a>,
            then find your user id in the script Moss sends to your email and enter it here.
          </p>
          <UForm ref="form" :state="state" class="flex flex-col sm:flex-row gap-2 sm:items-start" @submit="submit">
            <UFormField name="mossUserId" class="flex-1">
              <UInput v-model="state.mossUserId" placeholder="e.g. 123456789" inputmode="numeric" class="w-full" />
            </UFormField>
            <UButton type="submit" :loading="saving" icon="i-lucide-save">
              Save
            </UButton>
          </UForm>
          <p v-if="saveError" class="text-sm text-error mt-2">
            {{ saveError }}
          </p>
        </UCard>
      </div>

      <div class="space-y-4 lg:col-span-3">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-semibold">
                Detect similar submissions of <span dir="auto" class="text-primary">{{ data.assignment.name }}</span>
              </h3>
              <UButton
                icon="i-lucide-scan-search"
                :loading="busy"
                :disabled="busy || !data.mossUserId"
                @click="detect"
              >
                {{ busy ? 'Detecting…' : 'Detect similar codes' }}
              </UButton>
            </div>
          </template>
          <p class="text-sm text-muted">
            Sends the final submissions of every problem to Moss. Zip, PDF and TXT files are not sent.
            It may take a few minutes, please keep this page open.
          </p>
          <UProgress v-if="busy" animation="carousel" class="mt-3" size="xs" />
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-semibold">
                Results
              </h3>
              <span class="text-xs text-muted">
                Last update: {{ data.updateTime === 'Never' ? 'Never' : formatDateTime(data.updateTime) }}
              </span>
            </div>
          </template>
          <ul class="divide-y divide-default">
            <li v-for="p in data.problems" :key="p.id" class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-3">
              <span class="text-sm font-medium sm:w-48 shrink-0 truncate" dir="auto">
                {{ p.id }}. {{ p.name }}
              </span>
              <a
                v-if="isUrl(p.link)"
                :href="p.link ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary hover:underline break-all inline-flex items-center gap-1"
              >
                {{ p.link }}
                <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0" />
              </a>
              <span v-else-if="p.link !== null" class="text-sm text-warning">
                Link Not Found. Maybe you have entered wrong user id.
              </span>
              <span v-else class="text-sm text-muted">Link Not Found.</span>
            </li>
            <li v-if="!data.problems.length" class="px-4 py-6 text-center text-sm text-muted">
              This assignment has no problems.
            </li>
          </ul>
          <template #footer>
            <p class="text-xs text-muted">
              Moss links expire after some time.
            </p>
          </template>
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
