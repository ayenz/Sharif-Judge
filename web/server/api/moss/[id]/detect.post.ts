// Sends final submissions to Moss (legacy Moss::_detect). Synchronous like the legacy
// app; it can take minutes, each moss run has a 10 minute timeout.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const assignment = await getAssignment(id)
  if (!assignment.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  await mossDetect(assignment.id)
  return { ok: true }
})
