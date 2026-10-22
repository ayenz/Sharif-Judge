import type { LiveEvent } from '#shared/live'

type Handler = (event: LiveEvent) => void
const handlers = new Set<Handler>()

/** Delivers an event from /api/events to the subscribed components. */
export function liveDispatch(event: LiveEvent) {
  for (const handler of handlers)
    handler(event)
}

/**
 * Live updates from the server. `connected` tells pages whether they can stop
 * polling; `on` subscribes for the lifetime of the calling component.
 */
export function useLive() {
  const connected = useState('live-connected', () => false)

  function on<T extends LiveEvent['type']>(type: T, fn: (event: Extract<LiveEvent, { type: T }>) => void) {
    const handler: Handler = (event) => {
      if (event.type === type)
        fn(event as Extract<LiveEvent, { type: T }>)
    }
    if (import.meta.client) {
      handlers.add(handler)
      onBeforeUnmount(() => handlers.delete(handler))
    }
  }

  return { connected, on }
}
