// Loads Cloudflare's Turnstile script once, on the pages that need it (client only).
export interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

let loading: Promise<TurnstileApi> | undefined

export function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const w = window as unknown as { turnstile?: TurnstileApi }
    if (w.turnstile)
      return resolve(w.turnstile)
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('Turnstile did not load')))
    script.onerror = () => {
      loading = undefined
      reject(new Error('Could not load the security check'))
    }
    document.head.appendChild(script)
  })
  return loading
}
