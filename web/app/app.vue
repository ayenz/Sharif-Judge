<script setup lang="ts">
useHead({ titleTemplate: title => (title ? `${title} · SharIF Judge` : 'SharIF Judge') })
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
