// Add an assignment (multipart, see assignmentSaveFromRequest).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  return assignmentSaveFromRequest(event, null)
})
