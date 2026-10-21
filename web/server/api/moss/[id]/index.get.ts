// Moss page data (legacy Moss::index). Head instructors and admins only.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const assignment = await getAssignment(id)
  return {
    assignment: { id: assignment.id, name: assignment.name, problems: assignment.problems },
    mossUserId: await getSetting('moss_userid'),
    updateTime: assignment.id ? assignment.mossUpdate : 'Never',
    running: mossIsRunning(assignment.id),
    problems: assignment.id ? await mossProblemLinks(assignment.id) : [],
  }
})
