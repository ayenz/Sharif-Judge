import { eq } from 'drizzle-orm'

const { notifications } = schema

export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  await useDb().delete(notifications).where(eq(notifications.id, intParam(event, 'id')))
  return { ok: true }
})
