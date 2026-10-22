import { eq } from 'drizzle-orm'

const { users } = schema

async function findByKey(key: string) {
  if (!key)
    return undefined
  const [row] = await useDb().select().from(users).where(eq(users.passchangeKey, key))
  return row
}

export default defineEventHandler(async (event) => {
  rateLimitEnforce(event, [{ key: `reset-ip:${clientIp(event)}`, limit: 30, windowMs: 15 * 60 * 1000 }], 'Too many attempts.')
  rateLimitHit(`reset-ip:${clientIp(event)}`, 15 * 60 * 1000)
  const form = await readForm(event, z.object({
    key: z.string().min(1),
    password: rules.password.optional(),
    passwordAgain: z.string().optional(),
  }).refine(f => f.password === undefined || f.password === f.passwordAgain, { path: ['passwordAgain'], message: 'Passwords do not match.' }))

  const user = await findByKey(form.key)
  if (!user)
    throw createError({ statusCode: 400, statusMessage: 'Invalid password reset link.' })
  const age = (await nowEpoch()) - toEpoch(user.passchangeTime)
  if (age > 3600 || age < 0)
    throw createError({ statusCode: 400, statusMessage: 'The link is expired.' })

  // Without a password this only checks that the link is valid.
  if (form.password === undefined)
    return { valid: true }
  await useDb().update(users).set({ passchangeKey: '', password: hashUserPassword(form.password) }).where(eq(users.id, user.id))
  return { reset: true }
})
