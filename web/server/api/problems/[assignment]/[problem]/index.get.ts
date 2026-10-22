import { parseAllowedLanguages } from '#shared/languages'

// Problem page data (legacy Problems::index). Like the legacy app, any logged-in user
// can read descriptions; submitting and PDFs have their own checks.
export default defineEventHandler(async (event) => {
  const unavailable = await unavailableLanguages()
  const user = await requireUser(event)
  const assignmentId = intParam(event, 'assignment')
  const problemId = intParam(event, 'problem')
  if (assignmentId === 0)
    throw createError({ statusCode: 400, statusMessage: 'No assignment selected.' })
  const assignment = await getAssignment(assignmentId)
  if (!assignment.id || problemId < 1 || problemId > assignment.problems)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const all = await assignmentProblems(assignmentId)
  const p = all[problemId]
  const description = await problemReadDescription(assignmentId, problemId, 'html')
  const hasPdf = Boolean(await assignmentPdfPath(assignmentId, problemId))
  const blockedReason = await submitBlockedReason(assignment, user)

  return {
    assignment: {
      id: assignment.id,
      name: assignment.name,
      open: Boolean(assignment.open),
      startTime: assignment.startTime,
      finishTime: assignment.finishTime,
      extraTime: assignment.extraTime,
    },
    problems: Object.values(all).map(x => ({ id: x.id, name: x.name, score: x.score, isUploadOnly: Boolean(x.isUploadOnly) })),
    problem: {
      id: problemId,
      name: p?.name ?? `Problem ${problemId}`,
      score: p?.score ?? 0,
      isUploadOnly: Boolean(p?.isUploadOnly),
      cTimeLimit: p?.cTimeLimit ?? 0,
      pythonTimeLimit: p?.pythonTimeLimit ?? 0,
      javaTimeLimit: p?.javaTimeLimit ?? 0,
      memoryLimit: p?.memoryLimit ?? 0,
      allowedLanguages: parseAllowedLanguages(p?.allowedLanguages ?? '').filter(l => !unavailable.includes(l)),
      description,
      hasPdf,
      pdfBlockedReason: hasPdf ? await assignmentPdfBlockedReason(assignment, user) : null,
    },
    canSubmit: blockedReason === null,
    blockedReason,
  }
})
