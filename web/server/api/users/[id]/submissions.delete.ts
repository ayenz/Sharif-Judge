// Delete all submissions (rows and files) of a user.
export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const id = intParam(event, 'id')
  if (!await deleteUserSubmissions(id))
    throw createError({ statusCode: 404, statusMessage: 'Deleting Submissions Failed' })
  return { ok: true }
})
