// Zip of tests and descriptions of an assignment (legacy downloadtestsdesc).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const assignment = await getAssignment(id)
  if (!assignment.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const files = await assignmentTestsZipFiles(id, assignment.problems)
  return zipSend(event, `assignment${id}_tests_desc_${assignmentFileStamp(await nowStr())}.zip`, files)
})
