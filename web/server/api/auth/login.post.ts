const WINDOW = 15 * 60 * 1000

export default defineEventHandler(async (event) => {
  const { username, password } = await readForm(event, z.object({
    username: rules.username,
    password: rules.password,
  }))
  const ip = clientIp(event)
  // Failed attempts: per address and account, per address, and per account from anywhere.
  const keys = {
    pair: `login:${ip}:${username}`,
    ip: `login-ip:${ip}`,
    account: `login-account:${username}`,
  }
  rateLimitEnforce(event, [
    { key: keys.pair, limit: 8, windowMs: WINDOW },
    { key: keys.ip, limit: 30, windowMs: WINDOW },
    { key: keys.account, limit: 50, windowMs: WINDOW },
  ], 'Too many failed sign-in attempts.')

  if (!(await validateCredentials(username, password))) {
    for (const key of Object.values(keys))
      rateLimitHit(key, WINDOW)
    throw createError({ statusCode: 401, statusMessage: 'Incorrect username or password.' })
  }

  rateLimitReset(keys.pair)
  await replaceUserSession(event, { user: { username }, loggedInAt: Date.now() })
  await recordLogin(username, ip)
  return { ok: true }
})
