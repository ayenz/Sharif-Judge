// Scoreboard of the selected assignment (legacy Scoreboard::index), computed live.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const assignment = user.selectedAssignment
  const info = { id: assignment.id, name: assignment.name }
  if (!assignment.id)
    return { state: 'none' as const, assignment: info, scoreboard: null }
  if (!assignment.scoreboard)
    return { state: 'disabled' as const, assignment: info, scoreboard: null }
  return { state: 'ok' as const, assignment: info, scoreboard: await computeScoreboard(assignment.id) }
})
