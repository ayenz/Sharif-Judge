<script setup lang="ts">
import type { AssignmentFormData } from '~/components/AssignmentForm.vue'

definePageMeta({ minLevel: 2 })
const { data, error } = await useFetch<AssignmentFormData>('/api/assignments/0')
</script>

<template>
  <AppPage title="Add Assignment" icon="i-lucide-folder-plus">
    <UAlert v-if="error" color="error" variant="subtle" :title="apiError(error).message" />
    <AssignmentForm v-else-if="data" :initial="data" />
  </AppPage>
</template>
