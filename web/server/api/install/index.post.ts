import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createTablesSql, defaultSettings } from '../../database/install'
import { extraTablesSql } from '../../database/migrate'

const { settings, users } = schema

export default defineEventHandler(async (event) => {
  if (await tableExists('settings'))
    throw createError({ statusCode: 409, statusMessage: 'SharIF Judge is already installed.' })

  const form = await readForm(event, z.object({
    username: rules.username,
    email: rules.email,
    password: rules.password,
    passwordAgain: z.string(),
  }).refine(f => f.password === f.passwordAgain, { path: ['passwordAgain'], message: 'Passwords do not match.' }))

  const pool = usePool()
  const prefix = useRuntimeConfig().db.prefix
  for (const sql of [...createTablesSql(prefix), ...extraTablesSql(prefix)])
    await pool.query(sql)

  const { paths } = useRuntimeConfig()
  const defaults = defaultSettings({
    tester: paths.tester || resolve(process.cwd(), '../tester'),
    assignments: paths.assignments || resolve(process.cwd(), '../assignments'),
  })
  await mkdir(defaults.assignments_root!, { recursive: true }).catch(() => {})
  await useDb().insert(settings).values(Object.entries(defaults).map(([key, value]) => ({ key, value })))
  await useDb().insert(users).values({
    username: form.username,
    email: form.email,
    password: hashUserPassword(form.password),
    role: 'admin',
  })
  return { installed: true }
})
