<script setup lang="ts">
// Moss now lives in the "Moss (legacy)" tab of the cheat detection page; keep old links working.
definePageMeta({
  minLevel: 2,
  redirect: to => ({ path: `/cheat/${Number(to.params.id) || 0}`, query: { tab: 'moss' } }),
})
</script>

<template>
  <div />
</template>
