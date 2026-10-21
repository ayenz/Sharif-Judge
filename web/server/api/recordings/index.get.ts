// Recordings of the selected assignment (legacy Recording::all).
// Legacy allowed level >= 1 but only showed the menu for level >= 2; we use 2.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event, 2)
  const assignment = user.selectedAssignment
  if (!assignment.id)
    return { assignment: null, problems: [], recordings: [] }
  const query = getQuery(event)
  const problem = Number(query.problem)
  const username = typeof query.user === 'string' && /^[A-Za-z0-9]+$/.test(query.user) ? query.user : undefined
  const [problems, rows, names] = await Promise.all([
    assignmentProblems(assignment.id),
    recordingsList(assignment.id, {
      problem: Number.isInteger(problem) && problem > 0 ? problem : undefined,
      username,
    }),
    getNames(),
  ])
  return {
    assignment: { id: assignment.id, name: assignment.name },
    problems: Object.values(problems).map(p => ({ id: p.id, name: p.name })),
    recordings: rows.map(r => ({ ...r, name: names[r.username] ?? '' })),
  }
})
