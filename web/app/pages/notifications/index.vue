<script setup lang="ts">
const { level } = useMe()
const { data: notifications, status, refresh } = await useFetch('/api/notifications', { default: () => [] })
const route = useRoute()

// Highlight the notification linked from the dashboard (#n-<id>).
const target = computed(() => route.hash.startsWith('#n-') ? Number(route.hash.slice(3)) : 0)
</script>

<template>
  <AppPage title="Notifications" icon="i-lucide-bell">
    <div class="max-w-4xl mx-auto space-y-4">
      <div v-if="level >= 2" class="flex justify-end">
        <UButton to="/notifications/new" icon="i-lucide-plus" label="New notification" />
      </div>

      <div v-if="status === 'pending' && !notifications.length" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-32 w-full" />
      </div>

      <UEmpty
        v-else-if="!notifications.length"
        icon="i-lucide-bell-off"
        title="Nothing yet…"
        description="Announcements from your instructors will appear here."
        variant="naked"
        class="py-16"
      />

      <UCard
        v-for="n in notifications"
        :id="`n-${n.id}`"
        :key="n.id"
        class="scroll-mt-20 transition-shadow"
        :class="target === n.id ? 'ring-2 ring-primary' : ''"
      >
        <template #header>
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h2 class="font-semibold text-base" dir="auto">
                {{ n.title || 'Untitled' }}
              </h2>
              <p class="text-xs text-muted mt-0.5">
                <UIcon name="i-lucide-clock" class="align-[-2px]" /> {{ formatDateTime(n.time) }}
              </p>
            </div>
            <NotificationActions v-if="level >= 2" :id="n.id" :title="n.title" @deleted="refresh()" />
          </div>
        </template>
        <!-- Notification text is HTML written by head instructors (sanitized on save). -->
        <div class="prose-content text-sm break-words" dir="auto" v-html="n.text" />
      </UCard>
    </div>
  </AppPage>
</template>
