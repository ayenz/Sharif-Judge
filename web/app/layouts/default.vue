<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { me, level } = useMe()
const open = ref(false)

const links = computed<NavigationMenuItem[][]>(() => {
  const main: NavigationMenuItem[] = [
    { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/', exact: true },
    { label: 'Notifications', icon: 'i-lucide-bell', to: '/notifications' },
    { label: 'Assignments', icon: 'i-lucide-folder-open', to: '/assignments' },
    { label: 'Problems', icon: 'i-lucide-file-text', to: '/problems' },
    { label: 'Submit', icon: 'i-lucide-upload', to: '/submit' },
    { label: 'Final Submissions', icon: 'i-lucide-check-check', to: '/submissions/final' },
    { label: 'All Submissions', icon: 'i-lucide-list', to: '/submissions/all' },
    { label: 'Scoreboard', icon: 'i-lucide-trophy', to: '/scoreboard' },
    { label: 'Hall of Fame', icon: 'i-lucide-medal', to: '/hall-of-fame' },
  ]
  const tools: NavigationMenuItem[] = []
  if (level.value >= 2) {
    tools.push(
      { label: 'Recordings', icon: 'i-lucide-video', to: '/recordings' },
      { label: 'Rejudge', icon: 'i-lucide-rotate-ccw', to: '/rejudge' },
      { label: 'Queue', icon: 'i-lucide-list-ordered', to: '/queue' },
      { label: 'Cheat Detection', icon: 'i-lucide-scan-search', to: `/cheat/${me.value?.selectedAssignment.id ?? 0}` },
    )
  }
  if (level.value >= 3) {
    tools.push(
      { label: 'Users', icon: 'i-lucide-users', to: '/users' },
      { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
      { label: '24-hour Log', icon: 'i-lucide-history', to: '/logs' },
    )
  }
  if (tools.length)
    tools.unshift({ label: 'Tools', type: 'label' })
  return [main, tools]
})
</script>

<template>
  <UDashboardGroup unit="rem" storage-key="shj-layout">
    <UDashboardSidebar
      id="main"
      v-model:open="open"
      collapsible
      :collapsed-size="4"
      :default-size="15"
      class="app-sidebar bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center min-w-0" aria-label="SharIF Judge home">
          <AppLogo :with-text="!collapsed" />
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip />
        <UNavigationMenu v-if="links[1]?.length" :collapsed="collapsed" :items="links[1]" orientation="vertical" tooltip class="mt-4" />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
