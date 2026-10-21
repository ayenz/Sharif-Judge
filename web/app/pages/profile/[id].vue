<script setup lang="ts">
const route = useRoute()
const id = computed(() => Number(route.params.id))
if (!Number.isInteger(id.value) || id.value <= 0)
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
</script>

<template>
  <AppPage title="Profile" icon="i-lucide-user">
    <ProfileForm :key="id" :user-id="id" />
  </AppPage>
</template>
