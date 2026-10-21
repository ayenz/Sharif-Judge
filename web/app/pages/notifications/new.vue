<script setup lang="ts">
definePageMeta({ minLevel: 2 })
</script>

<template>
  <AppPage title="New notification" icon="i-lucide-bell-plus">
    <UCard class="max-w-4xl">
      <LazyNotificationEditor />
    </UCard>
  </AppPage>
</template>
