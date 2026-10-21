import { desc } from 'drizzle-orm'

const { logins } = schema

// 24-hour login log (admin), newest first.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  return useDb().select().from(logins).orderBy(desc(logins.loginId))
})
