// Recordings of one user for one problem (legacy Recording::index).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const assignmentId = intParam(event, 'assignment')
  const problemId = intParam(event, 'problem')
  const username = getRouterParam(event, 'username') ?? ''
  if (!/^[A-Za-z0-9]+$/.test(username))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const assignment = await getAssignment(assignmentId)
  if (!assignment.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const [problems, recordings, language, names] = await Promise.all([
    assignmentProblems(assignment.id),
    recordingsList(assignment.id, { problem: problemId, username }),
    recordingLanguage(assignment.id, problemId, username),
    getNames(),
  ])
  return {
    assignment: { id: assignment.id, name: assignment.name },
    problems: Object.values(problems).map(p => ({ id: p.id, name: p.name })),
    username,
    displayName: names[username] ?? '',
    language,
    recordings,
  }
})
