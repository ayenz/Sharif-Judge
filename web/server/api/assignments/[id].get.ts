// Data for the add/edit assignment form. Id 0 returns the defaults for a new assignment.
import { parseAllowedLanguages } from '#shared/languages'
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const defaultLateRule = await getSetting('default_late_rule')
  if (id === 0) {
    return {
      id: 0,
      name: '',
      startTime: '',
      finishTime: '',
      extraTime: '',
      participants: 'ALL',
      lateRule: defaultLateRule,
      open: false,
      scoreboard: false,
      javaexceptions: false,
      archived: false,
      problems: [],
      hasPdf: false,
      defaultLateRule,
    }
  }
  const a = await getAssignment(id)
  if (!a.id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const problems = Object.values(await assignmentProblems(id))
  return {
    id: a.id,
    name: a.name,
    startTime: a.startTime,
    finishTime: a.finishTime,
    extraTime: extraTimeFormat(a.extraTime),
    participants: a.participants,
    lateRule: a.lateRule,
    open: Boolean(a.open),
    scoreboard: Boolean(a.scoreboard),
    javaexceptions: Boolean(a.javaexceptions),
    archived: Boolean(a.archivedAssignment),
    problems: problems.map(p => ({
      name: p.name,
      score: p.score,
      cTimeLimit: p.cTimeLimit,
      pythonTimeLimit: p.pythonTimeLimit,
      javaTimeLimit: p.javaTimeLimit,
      memoryLimit: p.memoryLimit,
      languages: parseAllowedLanguages(p.allowedLanguages),
      diffCmd: p.diffCmd,
      diffArg: p.diffArg,
      isUploadOnly: Boolean(p.isUploadOnly),
    })),
    hasPdf: Boolean(await assignmentPdfPath(id)),
    defaultLateRule,
  }
})
