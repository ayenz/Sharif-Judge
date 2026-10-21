<script setup lang="ts">
// The SharIF "IF" square logo (same shapes and colors as the legacy logo_small.png),
// drawn as SVG so it stays sharp at any size. Navy squares lighten in dark mode.
defineProps<{ withText?: boolean }>()

const squares = {
  grey: [[0, 0, 5], [18, 0, 5]],
  navy: [[6, 0, 5], [12, 0, 5], [0, 6, 5], [0, 12, 5], [18, 12, 5], [0, 18, 11]],
  blue: [[6, 6, 5], [6, 12, 5], [12, 12, 5], [6, 18, 11]],
} as const
</script>

<template>
  <span class="inline-flex items-center gap-2 select-none">
    <svg viewBox="-1 -1 25 31" class="h-7 w-auto shrink-0 logo-mark" aria-hidden="true">
      <rect v-for="([x, y, h], i) in squares.grey" :key="`g${i}`" :x="x" :y="y" width="5" :height="h" rx="0.6" class="fill-[#b3b3b3] dark:fill-[#8a94a6]" />
      <rect v-for="([x, y, h], i) in squares.navy" :key="`n${i}`" :x="x" :y="y" width="5" :height="h" rx="0.6" class="fill-[#1b2c57] dark:fill-[#c3d1ec]" />
      <rect v-for="([x, y, h], i) in squares.blue" :key="`b${i}`" :x="x" :y="y" width="5" :height="h" rx="0.6" class="fill-[#3769b0] dark:fill-[#7d9fd6]" />
    </svg>
    <span v-if="withText" class="logo-text font-semibold tracking-tight whitespace-nowrap text-[#1b2c57] dark:text-[#dbe4f5]">
      Shar<span class="text-[#3769b0] dark:text-[#8fb0e3]">IF</span> <span class="font-normal text-muted">Judge</span>
    </span>
  </span>
</template>
