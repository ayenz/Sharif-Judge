import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'

const { users } = schema

export default defineEventHandler(async (event) => {
  // Each request may send a mail: keep it from being used to flood inboxes.
  rateLimitEnforce(event, [{ key: `lost-ip:${clientIp(event)}`, limit: 5, windowMs: 60 * 60 * 1000 }], 'Too many password reset requests.')
  rateLimitHit(`lost-ip:${clientIp(event)}`, 60 * 60 * 1000)
  const { email } = await readForm(event, z.object({ email: rules.email }))
  // Always answer the same way so the form cannot be used to probe for accounts.
  if (await emailTaken(email)) {
    const key = randomBytes(36).toString('base64url').slice(0, 50)
    await useDb().update(users).set({ passchangeKey: key, passchangeTime: await nowStr() }).where(eq(users.email, email))
    const site = siteUrl(event)
    const html = (await getSetting('reset_password_mail'))
      .replaceAll('{SITE_URL}', site)
      .replaceAll('{RESET_LINK}', `${site}reset/${key}`)
      .replaceAll('{VALID_TIME}', '1 hour')
    await sendMail(email, 'Password Reset', html)
  }
  return { ok: true }
})
