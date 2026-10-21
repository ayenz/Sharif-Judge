export default defineEventHandler(async (event) => {
  const { username, password } = await readForm(event, z.object({
    username: rules.username,
    password: rules.password,
  }))
  if (!(await validateCredentials(username, password)))
    throw createError({ statusCode: 401, statusMessage: 'Incorrect username or password.' })

  await replaceUserSession(event, { user: { username }, loggedInAt: Date.now() })
  await recordLogin(username, getRequestIP(event, { xForwardedFor: true }) ?? '')
  return { ok: true }
})
