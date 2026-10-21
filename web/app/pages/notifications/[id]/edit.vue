<script setup lang="ts">
definePageMeta({ minLevel: 2 })

const route = useRoute()
const id = Number(route.params.id)
const { data: notification, error } = await useFetch(`/api/notifications/${id}`)
if (error.value || !notification.value)
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
</script>

<template>
  <AppPage title="Edit notification" icon="i-lucide-pencil">
    <UCard v-if="notification" class="max-w-4xl">
      <p class="text-xs text-muted mb-4">
        Posted {{ formatDateTime(notification.time) }}
      </p>
      <LazyNotificationEditor :id="notification.id" :title="notification.title" :text="notification.text" />
    </UCard>
  </AppPage>
</template>
