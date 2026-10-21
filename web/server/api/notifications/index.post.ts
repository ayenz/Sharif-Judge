const { notifications } = schema

// New notification (head instructors and admins).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const form = await readForm(event, notificationFormSchema())
  const [result] = await useDb().insert(notifications).values({
    title: form.title,
    text: notificationSanitize(form.text),
    time: await nowStr(),
  })
  return { ok: true, id: result.insertId }
})
