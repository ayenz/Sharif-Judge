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
    <p class="text-xs text-muted">
      Online judge for C, C++, Java and Python
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
