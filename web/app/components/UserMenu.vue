<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed?: boolean }>()

const { me } = useMe()
const { colorMode, setMode } = useThemeSwitch()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  me.value = null
  await navigateTo('/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: me.value?.displayName || me.value?.username, description: me.value?.email }],
  [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }],
  [{
    label: 'Theme',
    icon: colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun',
    children: ([
      ['light', 'Light', 'i-lucide-sun'],
      ['dark', 'Dark', 'i-lucide-moon'],
      ['system', 'System', 'i-lucide-monitor'],
    ] as const).map(([mode, label, icon]) => ({
      label,
      icon,
      type: 'checkbox' as const,
      checked: colorMode.preference === mode,
      onSelect: (e: Event) => {
        e.preventDefault()
        setMode(mode)
      },
    })),
  }],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', color: 'error', onSelect: logout }],
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'center', collisionPadding: 12 }" :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }">
    <UButton
      :avatar="{ alt: me?.displayName || me?.username }"
      :label="collapsed ? undefined : (me?.displayName || me?.username)"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
