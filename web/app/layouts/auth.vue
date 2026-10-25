<script setup lang="ts">
// Same key as the sign-in pages, so the options are fetched once.
const { data: options } = await useFetch('/api/auth/options')
const languages = computed(() => {
  const list = options.value?.languages ?? []
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list.join('')
})
</script>

<template>
  <div class="relative min-h-dvh flex flex-col items-center justify-center gap-6 px-4 py-10 bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent">
    <div class="absolute top-3 right-3">
      <ColorModeToggle />
    </div>
    <NuxtLink to="/login" class="text-xl auth-in">
      <AppLogo with-text class="[&_svg]:h-9" />
    </NuxtLink>
    <UCard class="w-full max-w-sm shadow-lg shadow-primary/5 auth-in auth-in-delay" :ui="{ body: 'p-6 sm:p-7' }">
      <slot />
    </UCard>
    <p v-if="languages" class="text-xs text-muted text-center max-w-sm">
      Online judge for {{ languages }}
    </p>
  </div>
</template>

<style scoped>
.auth-in { animation: auth-in .45s cubic-bezier(.22, .8, .24, 1) both; }
.auth-in-delay { animation-delay: .06s; }
@keyframes auth-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
</style>
