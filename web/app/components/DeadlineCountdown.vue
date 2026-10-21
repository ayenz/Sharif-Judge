<script setup lang="ts">
// Time left of the selected assignment: until finish time, then the extra time.
const { me } = useMe()
const now = useServerNow()

const state = computed(() => {
  const a = me.value?.selectedAssignment
  if (!a?.id || !a.finishTime)
    return null
  const finish = wallClockToMs(a.finishTime)
  const extraEnd = finish + a.extraTime * 1000
  if (now.value < finish)
    return { label: 'Time left', seconds: (finish - now.value) / 1000, color: 'neutral' as const }
  if (now.value < extraEnd)
    return { label: 'Extra time', seconds: (extraEnd - now.value) / 1000, color: 'warning' as const }
  return { label: 'Finished', seconds: 0, color: 'error' as const }
})
</script>

<template>
  <ClientOnly>
    <div v-if="state" class="items-center gap-2 text-sm">
      <span class="text-muted">{{ state.label }}</span>
      <UBadge v-if="state.seconds > 0" :color="state.color" variant="subtle" class="font-mono tabular-nums">
        {{ humanDuration(state.seconds) }}
      </UBadge>
      <UBadge v-else color="error" variant="subtle">
        Closed
      </UBadge>
    </div>
  </ClientOnly>
</template>
