// Delete an assignment with its problems, submissions and folder (legacy Assignments::delete).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const a = await getAssignment(id)
  if (!a.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  await assignmentDelete(id)
  return { done: true }
})
