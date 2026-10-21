<script setup lang="ts">
import type { AssignmentFormData } from '~/components/AssignmentForm.vue'

definePageMeta({ minLevel: 2 })
const route = useRoute()
const { data, error } = await useFetch<AssignmentFormData>(() => `/api/assignments/${Number(route.params.id) || -1}`)
if (error.value?.statusCode === 404)
  throw createError({ statusCode: 404, statusMessage: 'Assignment not found', fatal: true })
</script>

<template>
  <AppPage :title="data ? `Edit Assignment · ${data.name}` : 'Edit Assignment'" icon="i-lucide-folder-pen">
    <UAlert v-if="error" color="error" variant="subtle" :title="apiError(error).message" />
    <AssignmentForm v-else-if="data" :key="data.id" :initial="data" />
  </AppPage>
</template>
