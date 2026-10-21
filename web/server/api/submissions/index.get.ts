export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const view = getQuery(event).view === 'final' ? 'final' : 'all'
  const q = submissionsQuery(event, view)
  const { items, total, perPage } = await submissionsList(user, q)
  const problems = Object.values(await assignmentProblems(user.selectedAssignment.id))
    .map(p => ({ id: p.id, name: p.name, score: p.score }))
  return { view, items, total, perPage, page: q.page, filterUser: q.filterUser, filterProblem: q.filterProblem, problems }
})
