import type { H3Event } from 'h3'

// In-memory sliding-window counters (the app runs as one process). Used to slow down
// password guessing and mail flooding.

const buckets = new Map<string, number[]>()

function recent(key: string, windowMs: number): number[] {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs)
  if (hits.length)
    buckets.set(key, hits)
  else
    buckets.delete(key)
  return hits
}

/** Records one event for `key`. */
export function rateLimitHit(key: string, windowMs: number) {
  buckets.set(key, [...recent(key, windowMs), Date.now()])
}

export function rateLimitReset(key: string) {
  buckets.delete(key)
}

/**
 * Throws 429 with a Retry-After header when any rule already has `limit` events
 * inside its window.
 */
export function rateLimitEnforce(event: H3Event, rules: { key: string, limit: number, windowMs: number }[], message: string) {
  for (const rule of rules) {
    const hits = recent(rule.key, rule.windowMs)
    if (hits.length >= rule.limit) {
      const retryAfter = Math.max(1, Math.ceil((hits[0]! + rule.windowMs - Date.now()) / 1000))
      setResponseHeader(event, 'Retry-After', retryAfter)
      const minutes = Math.ceil(retryAfter / 60)
      throw createError({ statusCode: 429, statusMessage: `${message} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` })
    }
  }
}

/**
 * Client address. X-Forwarded-For is only trusted when NUXT_TRUST_PROXY=true (behind a
 * reverse proxy); otherwise anyone could pick their own address and dodge the limits.
 */
export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: Boolean(useRuntimeConfig().trustProxy) }) ?? 'unknown'
}

// Drop expired entries now and then so the map does not grow without bound.
setInterval(() => {
  for (const key of buckets.keys())
    recent(key, 60 * 60 * 1000)
}, 10 * 60 * 1000).unref?.()
