<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · SharIF Judge` : 'SharIF Judge'),
  // Here rather than in nuxt.config so they follow the base URL set at run time.
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: withAppBase('/favicon.svg') },
    { rel: 'icon', href: withAppBase('/favicon.ico'), sizes: '16x16' },
  ],
})
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
