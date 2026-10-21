import nodemailer from 'nodemailer'

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

/** Absolute base URL of the site, used in mail templates. */
export function siteUrl(event: import('h3').H3Event): string {
  return getRequestURL(event).origin + '/'
}
