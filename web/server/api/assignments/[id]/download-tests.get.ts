// Export of an assignment: tests, descriptions and assignment.json (legacy downloadtestsdesc).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const assignment = await getAssignment(id)
  if (!assignment.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const files = await assignmentTestsZipFiles(assignment)
  return zipSend(event, `assignment${id}_export_${assignmentFileStamp(await nowStr())}.zip`, files)
})
