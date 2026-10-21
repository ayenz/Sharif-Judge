import { eq } from 'drizzle-orm'

const { notifications } = schema

// Edit a notification's title and text (time is kept, like legacy).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const form = await readForm(event, notificationFormSchema())
  if (!await notificationGet(id))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  await useDb().update(notifications)
    .set({ title: form.title, text: notificationSanitize(form.text) })
    .where(eq(notifications.id, id))
  return { ok: true }
})
