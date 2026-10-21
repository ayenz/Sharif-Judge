<script setup lang="ts">
const props = defineProps<{ title: string, icon?: string, wide?: boolean }>()
useHead({ title: () => props.title })
</script>

<template>
  <UDashboardPanel :id="title">
    <template #header>
      <UDashboardNavbar :title="title" :icon="icon">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <DeadlineCountdown class="hidden md:flex" />
          <AssignmentSwitcher />
          <ColorModeToggle />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar v-if="$slots.toolbar">
        <slot name="toolbar" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div :class="wide ? 'w-full' : 'w-full max-w-6xl mx-auto'">
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
