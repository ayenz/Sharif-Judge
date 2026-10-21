<script setup lang="ts">
const { me, refresh } = useMe()
const toast = useToast()
const { data: options, refresh: refreshOptions } = useFetch('/api/assignments/options', { key: 'assignment-options', default: () => [] })

const items = computed(() => {
  const list = options.value.map(a => ({
    label: a.name,
    value: a.id,
    suffix: a.archived ? 'archived' : undefined,
  }))
  return list
})

const selected = computed({
  get: () => me.value?.selectedAssignment.id || undefined,
  set: async (id?: number) => {
    if (!id || id === me.value?.selectedAssignment.id)
      return
    try {
      await $fetch('/api/assignments/select', { method: 'POST', body: { id } })
      await refresh()
      await refreshNuxtData()
    }
    catch (e) {
      toast.add({ title: apiError(e).message, color: 'error' })
    }
  },
})

defineExpose({ refreshOptions })
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    value-key="value"
    placeholder="Select assignment"
    icon="i-lucide-folder"
    :search-input="{ placeholder: 'Search assignments…' }"
    class="w-44 sm:w-64"
  />
</template>
