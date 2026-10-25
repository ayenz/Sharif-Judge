// Cloudflare Turnstile (a CAPTCHA alternative) for the forms anyone can use without signing in:
// sign-in, registration and password reset requests. The keys come from the environment
// (docker/.env); an admin switches it on in Settings (enable_turnstile), only after passing the
// check once with those keys, so a wrong key or host name cannot lock everybody out.
import type { H3Event } from 'h3'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 10_000

function keys() {
  const { turnstile } = useRuntimeConfig()
  return { siteKey: String(turnstile.siteKey || ''), secretKey: String(turnstile.secretKey || '') }
}

/** The site key when both keys are configured (Turnstile can be switched on), else null. */
export function turnstileConfiguredSiteKey(): string | null {
  const { siteKey, secretKey } = keys()
  return siteKey && secretKey ? siteKey : null
}

/** The site key for the sign-in pages' widget, or null when Turnstile is off. */
export async function turnstileSiteKey(): Promise<string | null> {
  const siteKey = turnstileConfiguredSiteKey()
  return siteKey && (await getSetting('enable_turnstile')) === '1' ? siteKey : null
}

/**
 * Throws a 422 for the form's `turnstile` field unless the request carries a token that
 * Cloudflare accepts. Does nothing when Turnstile is off. Fails closed: if Cloudflare cannot be
 * reached the request is refused, so the check cannot be skipped by cutting that connection.
 */
export async function turnstileRequire(event: H3Event): Promise<void> {
  if (!(await turnstileSiteKey()))
    return
  const body = await readBody<{ turnstileToken?: unknown }>(event).catch(() => null)
  await turnstileVerify(event, body?.turnstileToken, 'turnstile')
}

/**
 * Verifies a token with Cloudflare using the configured secret, whether or not Turnstile is
 * switched on (Settings uses it to prove the keys work before switching on). Throws a 422 for
 * `field` when the token is missing or rejected.
 */
export async function turnstileVerify(event: H3Event, tokenInput: unknown, field: string): Promise<void> {
  const token = typeof tokenInput === 'string' ? tokenInput : ''
  if (!token || token.length > 2048)
    throw validationError({ [field]: 'Please complete the security check.' })
  let ok = false
  try {
    const res = await $fetch<{ 'success': boolean, 'error-codes'?: string[] }>(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret: keys().secretKey, response: token, remoteip: clientIp(event) }),
      timeout: VERIFY_TIMEOUT_MS,
    })
    ok = res.success === true
    if (!ok)
      console.warn('[turnstile] token rejected:', (res['error-codes'] ?? []).join(', ') || 'no reason given')
  }
  catch (error) {
    console.warn('[turnstile] verification failed:', (error as Error).message)
    throw validationError({ [field]: 'The security check could not be verified. Please try again.' })
  }
  if (!ok)
    throw validationError({ [field]: 'The security check failed. Please try again.' })
}
