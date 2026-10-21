<script setup lang="ts">
const { isDark, toggle } = useThemeSwitch()
</script>

<template>
  <ClientOnly>
    <UTooltip :text="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
      <UButton
        color="neutral"
        variant="ghost"
        square
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        class="relative overflow-hidden"
        @click="toggle"
      >
        <span class="relative block size-5">
          <UIcon name="i-lucide-sun" class="theme-icon absolute inset-0 size-5" :class="isDark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'" />
          <UIcon name="i-lucide-moon" class="theme-icon absolute inset-0 size-5" :class="isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'" />
        </span>
      </UButton>
    </UTooltip>
    <template #fallback>
      <span class="inline-block size-9" />
    </template>
  </ClientOnly>
</template>

<style scoped>
.theme-icon { transition: opacity .25s ease, transform .35s cubic-bezier(.22, .8, .24, 1); }
</style>
