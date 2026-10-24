import { joinURL } from 'ufo'

/**
 * A path with the app's base URL in front (NUXT_APP_BASE_URL, "/" by default, e.g. "/judge/"
 * when the judge runs under a sub-path). $fetch, useFetch and NuxtLink add it themselves; use
 * this for links marked `external` (downloads), iframes, EventSource and head links.
 */
export function withAppBase(path: string): string {
  return joinURL(useRuntimeConfig().app.baseURL, path)
}
