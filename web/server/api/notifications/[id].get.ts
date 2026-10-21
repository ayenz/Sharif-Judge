// One notification with its full HTML, for the edit form.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const row = await notificationGet(intParam(event, 'id'))
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return row
})
