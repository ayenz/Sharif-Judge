import nodemailer from 'nodemailer'
import { withTrailingSlash } from 'ufo'

/** Sends an HTML mail using the SMTP config and the sender from settings. */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const { mail } = useRuntimeConfig()
  if (!mail.host) {
    console.warn(`[mail] SMTP is not configured, mail to ${to} was not sent`)
    return false
  }
  const transport = nodemailer.createTransport({
    host: mail.host,
    port: Number(mail.port),
    secure: Boolean(mail.secure),
    auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
  })
  const [from, fromName] = await Promise.all([getSetting('mail_from'), getSetting('mail_from_name')])
  try {
    await transport.sendMail({ from: { address: from, name: fromName }, to, subject, html })
    return true
  }
  catch (error) {
    console.warn(`[mail] sending to ${to} failed:`, (error as Error).message)
    return false
  }
}

/**
 * Absolute base URL of the site, used in mail templates: the origin the browser used plus the
 * app's base URL. Behind a proxy (NUXT_TRUST_PROXY=true) the scheme comes from
 * X-Forwarded-Proto, so links are https. The host always comes from the Host header, which the
 * proxy passes on: X-Forwarded-Host is not used, because a proxy that does not set it would let a
 * client choose the host of a password-reset link.
 */
export function siteUrl(event: import('h3').H3Event): string {
  const config = useRuntimeConfig()
  return getRequestURL(event, { xForwardedProto: Boolean(config.trustProxy) }).origin + withTrailingSlash(config.app.baseURL)
}
