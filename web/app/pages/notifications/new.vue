<script setup lang="ts">
definePageMeta({ minLevel: 2 })
</script>

<template>
  <AppPage title="New notification" icon="i-lucide-bell-plus">
    <UCard >
      <LazyNotificationEditor />
    </UCard>
  </AppPage>
</template>
