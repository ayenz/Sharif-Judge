import type { LiveEvent } from '#shared/live'

// One EventSource per tab while signed in. EventSource reconnects by itself; pages
// fall back to polling while `connected` is false.
export default defineNuxtPlugin(() => {
  const { me } = useMe()
  const { connected } = useLive()
  const toast = useToast()
  let source: EventSource | null = null

  const TYPES: LiveEvent['type'][] = ['judged', 'executed', 'queue', 'cheat', 'notification']

  function open() {
    close()
    source = new EventSource(withAppBase('/api/events'))
    source.addEventListener('ready', () => (connected.value = true))
    source.onerror = () => (connected.value = false)
    for (const type of TYPES) {
      source.addEventListener(type, (message) => {
        try {
          const event = JSON.parse((message as MessageEvent).data) as LiveEvent
          liveDispatch(event)
          announce(event)
        }
        catch {}
      })
    }
  }

  function close() {
    source?.close()
    source = null
    connected.value = false
  }

  function announce(event: LiveEvent) {
    if (event.type === 'judged' && event.username === me.value?.username) {
      const full = event.status === 'SCORE' && event.preScore === 10000
      const result = event.status === 'SCORE' ? `Score ${Math.round(event.preScore / 100)}%` : event.status
      toast.add({
        title: `Submission #${event.submitId} judged`,
        description: `Problem ${event.problem} · ${result}`,
        color: full ? 'success' : event.status === 'SCORE' ? 'warning' : 'error',
        icon: full ? 'i-lucide-circle-check' : 'i-lucide-circle-alert',
        actions: [{ label: 'View', to: '/submissions/all' }],
      })
    }
    if (event.type === 'notification') {
      toast.add({
        title: 'New notification',
        description: event.title || undefined,
        icon: 'i-lucide-bell',
        color: 'info',
        actions: [{ label: 'Open', to: '/notifications' }],
      })
    }
  }

  watch(() => me.value?.username, (username) => {
    if (username)
      open()
    else
      close()
  }, { immediate: true })

  window.addEventListener('pagehide', close)
})
