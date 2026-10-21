import type { NitroFetchOptions } from 'nitropack'

/**
 * $fetch with a plain return type. Nuxt's typed route inference can exhaust the
 * TypeScript checker on some calls; use this when you annotate the result yourself.
 */
export function api<T = unknown>(url: string, options?: NitroFetchOptions<string>): Promise<T> {
  return ($fetch as unknown as (url: string, options?: object) => Promise<T>)(url, options)
}
