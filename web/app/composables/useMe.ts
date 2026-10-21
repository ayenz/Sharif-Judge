export interface SelectedAssignment {
  id: number
  name: string
  problems: number
  open: number
  scoreboard: number
  startTime: string
  finishTime: string
  extraTime: number
  participants: string
  archivedAssignment: number
}

export interface Me {
  id: number
  username: string
  displayName: string
  email: string
  role: 'admin' | 'head_instructor' | 'instructor' | 'student'
  level: number
  selectedAssignment: SelectedAssignment
}

/** The logged-in user, shared across the app. Call refresh() after login or changing assignment. */
export function useMe() {
  const me = useState<Me | null>('me', () => null)
  const loaded = useState('me-loaded', () => false)
  // Server wall clock minus browser clock, in ms. Server time is a wall-clock string in
  // the judge timezone, so we keep it as "UTC" and format it back with timeZone: 'UTC'.
  const clockOffset = useState('clock-offset', () => 0)
  const fetcher = useRequestFetch()

  async function refresh() {
    const data = await fetcher<{ user: Me | null, serverTime?: string }>('/api/me')
    me.value = data.user
    if (data.serverTime)
      clockOffset.value = wallClockToMs(data.serverTime) - Date.now()
    loaded.value = true
  }

  const level = computed(() => me.value?.level ?? -1)
  return { me, loaded, level, clockOffset, refresh }
}

/** Parses a "YYYY-MM-DD HH:MM:SS" wall-clock string as UTC milliseconds. */
export function wallClockToMs(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}Z`)
}

/** Current server wall-clock time in ms (format with timeZone 'UTC'). */
export function useServerNow(intervalMs = 1000) {
  const { clockOffset } = useMe()
  const now = ref(Date.now() + clockOffset.value)
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now() + clockOffset.value), intervalMs)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return now
}
