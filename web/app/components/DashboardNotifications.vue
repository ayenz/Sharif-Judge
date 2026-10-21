<script setup lang="ts">
defineProps<{ notifications: { id: number, title: string, time: string, text: string }[] }>()
const emit = defineEmits<{ changed: [] }>()
const { level } = useMe()
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-bell" class="size-5 text-primary" />
        <h2 class="font-semibold">
          Latest notifications
        </h2>
        <div class="ms-auto flex gap-1">
          <UButton v-if="level >= 2" to="/notifications/new" size="xs" icon="i-lucide-plus" color="neutral" variant="ghost" aria-label="New notification" />
          <UButton to="/notifications" size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" label="All" />
        </div>
      </div>
    </template>
    <UEmpty v-if="!notifications.length" icon="i-lucide-bell-off" title="Nothing yet…" variant="naked" class="py-10" />
    <ul v-else class="divide-y divide-default max-h-[28rem] overflow-y-auto">
      <li v-for="n in notifications" :key="n.id" class="group px-4 sm:px-6 py-3 hover:bg-elevated/50 transition-colors">
        <div class="flex items-start gap-2">
          <NuxtLink :to="`/notifications#n-${n.id}`" class="min-w-0 flex-1">
            <p class="font-medium text-sm truncate group-hover:text-primary" dir="auto">
              {{ n.title || 'Untitled' }}
            </p>
            <p class="text-xs text-muted">
              {{ formatDateTime(n.time) }}
            </p>
            <p class="text-sm text-muted line-clamp-2 mt-1" dir="auto">
              {{ n.text }}
            </p>
          </NuxtLink>
          <NotificationActions v-if="level >= 2" :id="n.id" :title="n.title" size="xs" class="opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" @deleted="emit('changed')" />
        </div>
      </li>
    </ul>
  </UCard>
</template>
