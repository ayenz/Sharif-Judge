import { EventEmitter } from 'node:events'
import type { LiveEvent } from '#shared/live'

// In-process event bus behind /api/events (server-sent events). The app is a single
// process, so an EventEmitter is enough; publishers never wait for subscribers.

const bus = new EventEmitter()
bus.setMaxListeners(0)

export interface LiveAudience {
  /** Only this user (plus staff when minLevel is also set). */
  username?: string
  /** Users with at least this level. */
  minLevel?: number
}

export interface LiveEnvelope {
  event: LiveEvent
  audience: LiveAudience
}

export function livePublish(event: LiveEvent, audience: LiveAudience = {}) {
  bus.emit('event', { event, audience } satisfies LiveEnvelope)
}

export function liveSubscribe(handler: (envelope: LiveEnvelope) => void): () => void {
  bus.on('event', handler)
  return () => bus.off('event', handler)
}

/** Whether a user may receive an event. */
export function liveVisibleTo(audience: LiveAudience, user: { username: string, level: number }): boolean {
  if (audience.username === undefined && audience.minLevel === undefined)
    return true
  if (audience.username !== undefined && audience.username === user.username)
    return true
  return audience.minLevel !== undefined && user.level >= audience.minLevel
}
