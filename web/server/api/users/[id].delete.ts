// Delete a user together with their submissions and files.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const id = intParam(event, 'id')
  if (!await deleteUser(id))
    throw createError({ statusCode: 404, statusMessage: 'Deleting User Failed' })
  return { ok: true }
})
