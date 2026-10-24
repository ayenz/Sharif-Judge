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
 * Client address. X-Forwarded-For is only trusted when NUXT_TRUST_PROXY is set (behind a
 * reverse proxy); otherwise anyone could pick their own address and dodge the limits.
 * Proxies append to the header (nginx's $proxy_add_x_forwarded_for), so its first entry is
 * whatever the client sent. The address is counted from the right instead: NUXT_TRUST_PROXY=true
 * is one proxy (the last entry), a number N is N proxies in a row (e.g. 2 for Cloudflare in
 * front of nginx).
 */
export function clientIp(event: H3Event): string {
  const trust = useRuntimeConfig().trustProxy as boolean | number | string
  const hops = trust === true || trust === 'true' ? 1 : Math.max(0, Math.floor(Number(trust)) || 0)
  if (hops) {
    const entries = (getRequestHeader(event, 'x-forwarded-for') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const ip = entries[Math.max(0, entries.length - hops)]
    if (ip)
      return ip
  }
  return getRequestIP(event) ?? 'unknown'
}

// Drop expired entries now and then so the map does not grow without bound.
setInterval(() => {
  for (const key of buckets.keys())
    recent(key, 60 * 60 * 1000)
}, 10 * 60 * 1000).unref?.()
