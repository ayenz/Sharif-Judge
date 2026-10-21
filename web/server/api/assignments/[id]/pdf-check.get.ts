// Whether the current user can open the assignment PDF (or ?problem=N PDF) now (legacy pdfCheck).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = intParam(event, 'id')
  const q = getQuery(event).problem
  const problem = q !== undefined && q !== 'null' ? Number(q) : null
  if (problem !== null && (!Number.isInteger(problem) || problem < 1))
    return { status: false }
  const assignment = await getAssignment(id)
  if (!assignment.id || !(await assignmentPdfPath(id, problem)))
    return { status: false }
  return { status: (await assignmentPdfBlockedReason(assignment, user)) === null }
})
