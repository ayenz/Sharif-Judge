export default defineEventHandler(async (event) => {
  rateLimitEnforce(event, [{ key: `register-ip:${clientIp(event)}`, limit: 10, windowMs: 60 * 60 * 1000 }], 'Too many registration attempts.')
  rateLimitHit(`register-ip:${clientIp(event)}`, 60 * 60 * 1000)
  if (await getSetting('enable_registration') !== '1')
    throw createError({ statusCode: 403, statusMessage: 'Registration is closed.' })

  const code = await getSetting('registration_code')
  const form = await readForm(event, z.object({
    registrationCode: z.string().optional().default(''),
    username: rules.username,
    email: rules.email,
    displayName: z.string().trim().max(40).optional().default(''),
    password: rules.password,
    passwordAgain: z.string(),
  })
    .refine(f => code === '0' || f.registrationCode === code, { path: ['registrationCode'], message: 'Invalid registration code.' })
    .refine(f => f.password === f.passwordAgain, { path: ['passwordAgain'], message: 'Passwords do not match.' }))

  const errors: Record<string, string> = {}
  if (await findUser(form.username))
    errors.username = 'This username already exists.'
  if (await emailTaken(form.email))
    errors.email = 'This email address already exists.'
  if (Object.keys(errors).length)
    throw validationError(errors)

  const result = await addUser(form.username, form.email, form.displayName, form.password, 'student')
  if (result !== true)
    throw validationError({ _: result })
  return { ok: true }
})
