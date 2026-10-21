import { eq } from 'drizzle-orm'
import { ROLES } from '#shared/roles'

const { users } = schema

// Update a profile: display name, email, password, and (admins only) role.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const target = await usersProfileTarget(event, me)

  const form = await readForm(event, z.object({
    displayName: z.string().trim().max(40, 'The name field cannot exceed 40 characters in length.').optional(),
    email: z.string().trim().min(1, 'The email address field is required.').pipe(rules.email),
    password: z.string().optional().default('')
      .refine(p => p.length === 0 || (p.length >= 6 && p.length <= 200), 'The password field must be between 6 and 200 characters in length.'),
    passwordAgain: z.string().optional().default(''),
    role: z.string().optional(),
  }).refine(f => f.password === f.passwordAgain, { path: ['passwordAgain'], message: 'The password confirmation field does not match the password field.' }))

  // Legacy _role_check: non-admins must not send a role, admins must send a valid one.
  if (me.level < 3 ? Boolean(form.role) : !ROLES.includes(form.role as typeof ROLES[number]))
    throw validationError({ role: me.level < 3 ? 'You cannot change the user role.' : 'The role field is not valid.' })

  if (await emailTaken(form.email, target.username))
    throw validationError({ email: 'This email address already exists.' })

  // Legacy keeps the old display name when lock_student_display_name is on, for everyone.
  // We exempt admins, otherwise there is no way to fix a student's name while the lock is on.
  const locked = await getSetting('lock_student_display_name') === '1' && me.level < 3
  const update: Partial<typeof users.$inferInsert> = {
    displayName: locked ? target.displayName : (form.displayName ?? target.displayName),
    email: form.email,
  }
  if (me.level >= 3 && form.role)
    update.role = form.role
  if (form.password)
    update.password = hashUserPassword(form.password)

  await useDb().update(users).set(update).where(eq(users.id, target.id))
  return { ok: true }
})
