// Rejudge every submission of a problem in the selected assignment.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 2)
  const { problemId } = await readForm(event, z.object({ problemId: rules.id }))
  await queueRejudgeProblem(user.selectedAssignment.id, problemId)
  queueKick()
  return { ok: true, message: 'Rejudge in progress' }
})
