// Assignments list (legacy Assignments::index), newest first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await allAssignments()
  const now = await nowEpoch()
  const list = await Promise.all(rows.map(async (a) => {
    const delay = now - toEpoch(a.finishTime)
    const hasPdf = Boolean(await assignmentPdfPath(a.id))
    return {
      id: a.id,
      name: a.name,
      problems: a.problems,
      totalSubmits: a.totalSubmits,
      startTime: a.startTime,
      finishTime: a.finishTime,
      extraTime: a.extraTime,
      open: Boolean(a.open),
      scoreboard: Boolean(a.scoreboard),
      archived: Boolean(a.archivedAssignment),
      coefficient: evalLateRule(a.lateRule, delay, a.extraTime),
      finished: delay > a.extraTime,
      pdf: hasPdf ? ((await assignmentPdfBlockedReason(a, user)) ?? 'ok') : null,
    }
  }))
  return list.reverse()
})
