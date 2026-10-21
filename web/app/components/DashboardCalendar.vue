<script setup lang="ts">
// Month calendar with markers on assignment start and finish dates.
import { CalendarDate, parseDate, type DateValue } from '@internationalized/date'

interface CalendarAssignment {
  id: number
  name: string
  startTime: string
  finishTime: string
  color: string
}

const props = defineProps<{ assignments: CalendarAssignment[], weekStart: number, today: string }>()

const todayDate = parseDate(props.today.slice(0, 10))
const selected = shallowRef<DateValue | undefined>(todayDate)
const placeholder = shallowRef<DateValue>(todayDate)

function key(d: DateValue) {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

/** Events by date: "YYYY-MM-DD" → list of starts / finishes. */
const events = computed(() => {
  const map = new Map<string, { a: CalendarAssignment, kind: 'start' | 'finish' }[]>()
  const add = (date: string, a: CalendarAssignment, kind: 'start' | 'finish') => {
    const k = date.slice(0, 10)
    map.set(k, [...(map.get(k) ?? []), { a, kind }])
  }
  for (const a of props.assignments) {
    add(a.startTime, a, 'start')
    add(a.finishTime, a, 'finish')
  }
  return map
})

const selectedEvents = computed(() => (selected.value ? events.value.get(key(selected.value)) ?? [] : []))

function goToday() {
  placeholder.value = new CalendarDate(todayDate.year, todayDate.month, todayDate.day)
  selected.value = todayDate
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-[auto_1fr]">
    <UCalendar
      v-model="selected"
      v-model:placeholder="placeholder"
      :week-starts-on="(weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6)"
      :year-controls="false"
      fixed-weeks
      class="mx-auto"
    >
      <template #day="{ day }">
        <span class="relative">
          {{ day.day }}
          <span v-if="events.get(key(day))" class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            <span
              v-for="(e, i) in events.get(key(day))!.slice(0, 3)"
              :key="i"
              class="size-1.5 rounded-full"
              :class="[e.a.color, e.kind === 'start' ? 'opacity-40' : '']"
            />
          </span>
        </span>
      </template>
    </UCalendar>

    <div class="min-w-0">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-sm font-medium">
          {{ selected ? formatDate(`${key(selected)} 00:00:00`) : 'Pick a day' }}
        </p>
        <UButton size="xs" color="neutral" variant="ghost" label="Today" @click="goToday" />
      </div>
      <ul v-if="selectedEvents.length" class="space-y-2">
        <li v-for="(e, i) in selectedEvents" :key="i" class="flex items-start gap-2 text-sm">
          <span class="mt-1.5 size-2 rounded-full shrink-0" :class="e.a.color" />
          <div class="min-w-0">
            <p class="truncate font-medium">
              {{ e.a.name }}
            </p>
            <p class="text-xs text-muted">
              {{ e.kind === 'start' ? 'Starts' : 'Deadline' }} at {{ (e.kind === 'start' ? e.a.startTime : e.a.finishTime).slice(11, 16) }}
            </p>
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">
        No assignment starts or ends on this day.
      </p>
      <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-primary opacity-40" /> start</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-primary" /> deadline</span>
      </div>
    </div>
  </div>
</template>
