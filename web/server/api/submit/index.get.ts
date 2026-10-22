import { parseAllowedLanguages } from '#shared/languages'

// Everything the submit page needs for the selected assignment.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const python2 = await python2Enabled()
  const assignment = user.selectedAssignment
  const problems = Object.values(await assignmentProblems(assignment.id)).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isUploadOnly: Boolean(p.isUploadOnly),
    languages: parseAllowedLanguages(p.allowedLanguages).filter(l => python2 || l !== 'Python 2'),
  }))
  return {
    assignment: { id: assignment.id, name: assignment.name },
    problems,
    coefficient: assignment.id ? await currentCoefficient(assignment) : 'error',
    blocked: await submitBlockedReason(assignment, user),
    fileSizeLimit: Number(await getSetting('file_size_limit')),
  }
})
