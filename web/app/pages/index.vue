<script setup lang="ts">
const { me, refresh: refreshMe } = useMe()
const toast = useToast()
const { data, refresh } = await useFetch('/api/dashboard')

// Same palette idea as the legacy calendar: one color per assignment.
const COLORS = ['bg-violet-500', 'bg-orange-500', 'bg-blue-500', 'bg-teal-600', 'bg-rose-600', 'bg-sky-600', 'bg-green-600', 'bg-amber-600']

const now = useServerNow(1000)
const mounted = ref(false)
onMounted(() => (mounted.value = true))

type Status = 'upcoming' | 'open' | 'extra' | 'finished'
const STATUS: Record<Status, { label: string, color: 'info' | 'success' | 'warning' | 'neutral', icon: string }> = {
  upcoming: { label: 'Upcoming', color: 'info', icon: 'i-lucide-calendar-clock' },
  open: { label: 'Open', color: 'success', icon: 'i-lucide-circle-play' },
  extra: { label: 'Extra time', color: 'warning', icon: 'i-lucide-hourglass' },
  finished: { label: 'Finished', color: 'neutral', icon: 'i-lucide-circle-check' },
}

/** Assignments with a live status computed from the judge server clock. */
const assignments = computed(() => (data.value?.assignments ?? []).map((a, i) => {
  const start = wallClockToMs(a.startTime)
  const finish = wallClockToMs(a.finishTime)
  const extraEnd = finish + a.extraTime * 1000
  const t = now.value
  let status: Status = 'finished'
  let seconds = 0
  if (t < start) {
    status = 'upcoming'
    seconds = (start - t) / 1000
  }
  else if (t <= finish) {
    status = 'open'
    seconds = (finish - t) / 1000
  }
  else if (t <= extraEnd) {
    status = 'extra'
    seconds = (extraEnd - t) / 1000
  }
  return { ...a, color: COLORS[i % COLORS.length]!, status, seconds, start, finish }
}))

/** Running assignments by deadline, then upcoming ones by start time. */
const deadlines = computed(() => {
  const active = assignments.value.filter(a => a.status === 'open' || a.status === 'extra').sort((a, b) => a.seconds - b.seconds)
  const upcoming = assignments.value.filter(a => a.status === 'upcoming').sort((a, b) => a.start - b.start)
  return [...active, ...upcoming]
})
const recentlyFinished = computed(() => assignments.value.filter(a => a.status === 'finished').sort((a, b) => b.finish - a.finish).slice(0, 3))

const stats = computed(() => {
  const s = data.value?.stats
  const cards = [
    { label: 'Open now', value: assignments.value.filter(a => (a.status === 'open' || a.status === 'extra') && a.open).length, icon: 'i-lucide-circle-play', color: 'text-success bg-success/10' },
    { label: 'Upcoming', value: assignments.value.filter(a => a.status === 'upcoming').length, icon: 'i-lucide-calendar-clock', color: 'text-info bg-info/10' },
    { label: 'My submissions', value: s?.mySubmissions ?? 0, icon: 'i-lucide-upload', color: 'text-primary bg-primary/10' },
    { label: 'Notifications this week', value: s?.recentNotifications ?? 0, icon: 'i-lucide-bell', color: 'text-warning bg-warning/10' },
  ]
  if (s?.users !== null && s?.users !== undefined)
    cards.push({ label: 'Users', value: s.users, icon: 'i-lucide-users', color: 'text-error bg-error/10' })
  return cards
})

const opening = ref(0)
async function openAssignment(id: number) {
  opening.value = id
  try {
    if (me.value?.selectedAssignment.id !== id) {
      await $fetch('/api/assignments/select', { method: 'POST', body: { id } })
      await refreshMe()
    }
    await navigateTo('/problems')
  }
  catch (e) {
    toast.add({ title: apiError(e).message, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    opening.value = 0
  }
}

// Poll for new notifications (legacy notifications/check, every 30 s).
let lastCheck = data.value?.serverTime ?? ''
let timer: ReturnType<typeof setInterval> | undefined
// Live updates announce new notifications; poll only when the live connection is down.
const live = useLive()
live.on('notification', () => refresh())
async function checkNotifications() {
  if (!lastCheck || document.hidden || live.connected.value)
    return
  try {
    const res = await $fetch('/api/notifications/check', { method: 'POST', body: { time: lastCheck } })
    lastCheck = res.serverTime
    if (res.new) {
      toast.add({ title: 'New notification', icon: 'i-lucide-bell-ring', color: 'info', actions: [{ label: 'View', to: '/notifications' }] })
      await refresh()
    }
  }
  catch {
    // Network hiccup or session expired: try again on the next tick.
  }
}
onMounted(() => (timer = setInterval(checkNotifications, 30_000)))
onBeforeUnmount(() => clearInterval(timer))

const greeting = computed(() => {
  const h = new Date(now.value).getUTCHours()
  return h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Good night'
})
</script>

<template>
  <AppPage title="Dashboard" icon="i-lucide-layout-dashboard">
    <div v-if="data" class="space-y-6">
      <UAlert
        v-for="(err, i) in data.errors"
        :key="i"
        color="error"
        variant="subtle"
        icon="i-lucide-folder-x"
        :title="err.path ? `The folder &quot;${err.path}&quot; is not writable.` : 'Folder not found'"
        :description="err.message"
        :actions="[{ label: 'Settings', to: '/settings', color: 'error', variant: 'outline' }]"
      />

      <div>
        <h1 class="text-xl font-semibold">
          {{ greeting }}, {{ me?.displayName || me?.username }}
        </h1>
        <p class="text-sm text-muted">
          Judge time: {{ formatDateTime(data.serverTime) }}
        </p>
      </div>

      <div class="grid gap-3 grid-cols-2" :class="stats.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'">
        <UCard v-for="s in stats" :key="s.label" class="lift" :ui="{ body: 'p-4 sm:p-4' }">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-lg grid place-items-center shrink-0" :class="s.color">
              <UIcon :name="s.icon" class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-2xl font-semibold tabular-nums leading-tight">
                {{ s.value }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ s.label }}
              </p>
            </div>
          </div>
        </UCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-3 space-y-6 min-w-0">
          <!-- Deadlines -->
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-alarm-clock" class="size-5 text-primary" />
                <h2 class="font-semibold">
                  Upcoming deadlines
                </h2>
              </div>
            </template>
            <UEmpty
              v-if="!deadlines.length && !recentlyFinished.length"
              icon="i-lucide-calendar-off"
              title="No assignments"
              description="There are no active assignments right now."
              variant="naked"
              class="py-10"
            />
            <ul v-else class="divide-y divide-default">
              <li
                v-for="a in [...deadlines, ...recentlyFinished]"
                :key="a.id"
                class="flex items-center gap-3 px-4 sm:px-6 py-3"
                :class="a.status === 'finished' ? 'opacity-70' : ''"
              >
                <span class="w-1 self-stretch rounded-full shrink-0" :class="a.color" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p class="font-medium truncate">
                      {{ a.name }}
                    </p>
                    <UBadge :color="STATUS[a.status].color" variant="subtle" size="sm" :icon="STATUS[a.status].icon">
                      {{ STATUS[a.status].label }}
                    </UBadge>
                    <UBadge v-if="!a.open" color="neutral" variant="outline" size="sm" icon="i-lucide-lock">
                      Closed
                    </UBadge>
                  </div>
                  <p class="text-xs text-muted mt-0.5">
                    <template v-if="a.status === 'upcoming'">
                      Starts {{ formatDateTime(a.startTime) }}
                    </template>
                    <template v-else>
                      Deadline {{ formatDateTime(a.finishTime) }}
                    </template>
                    · {{ a.problems }} problem{{ a.problems === 1 ? '' : 's' }}
                  </p>
                </div>
                <div class="text-right shrink-0 hidden sm:block">
                  <p v-if="mounted && a.status !== 'finished'" class="text-sm font-mono tabular-nums" :class="a.status === 'extra' ? 'text-warning' : a.status === 'open' && a.seconds < 3600 ? 'text-error' : ''">
                    {{ humanDuration(a.seconds) }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ a.status === 'upcoming' ? 'until start' : a.status === 'finished' ? 'finished' : 'left' }}
                  </p>
                </div>
                <UButton
                  icon="i-lucide-arrow-right"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :loading="opening === a.id"
                  :aria-label="`Open ${a.name}`"
                  @click="openAssignment(a.id)"
                />
              </li>
            </ul>
          </UCard>

          <!-- Calendar -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar" class="size-5 text-primary" />
                <h2 class="font-semibold">
                  Calendar
                </h2>
              </div>
            </template>
            <DashboardCalendar :assignments="assignments" :week-start="data.weekStart" :today="data.serverTime" />
          </UCard>
        </div>

        <div class="lg:col-span-2 min-w-0">
          <DashboardNotifications :notifications="data.notifications" @changed="refresh()" />
        </div>
      </div>
    </div>
  </AppPage>
</template>
