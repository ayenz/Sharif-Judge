import { access } from 'node:fs/promises'
import { and, eq } from 'drizzle-orm'
import { CHEAT_LANGUAGES, fileTypeToCheatLanguage } from '#shared/cheat'

// Overview for the cheat detection page: problems, latest runs, Moss links.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'assignment')
  const assignment = await getAssignment(id)
  if (!assignment.id)
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })

  const finals = await useDb().select({ problem: schema.submissions.problem, fileType: schema.submissions.fileType })
    .from(schema.submissions)
    .where(and(eq(schema.submissions.assignment, id), eq(schema.submissions.isFinal, 1)))
  const problems = []
  for (const p of Object.values(await assignmentProblems(id))) {
    const counts: Record<string, number> = {}
    for (const f of finals.filter(f => f.problem === p.id)) {
      const lang = fileTypeToCheatLanguage(f.fileType)
      if (lang)
        counts[lang] = (counts[lang] ?? 0) + 1
    }
    const baseCode: Record<string, boolean> = {}
    for (const lang of CHEAT_LANGUAGES)
      baseCode[lang] = await access(await cheatBaseCodePath(id, p.id, lang)).then(() => true, () => false)
    problems.push({ id: p.id, name: p.name, isUploadOnly: Boolean(p.isUploadOnly), counts, baseCode })
  }

  const runs = await cheatLatestRuns(id)
  return {
    assignment: { id: assignment.id, name: assignment.name, mossUpdate: assignment.mossUpdate },
    engineAvailable: await cheatEngineAvailable(),
    working: cheatIsWorking(),
    problems,
    runs: await Promise.all(runs.map(async r => ({ ...r, reportSize: r.status === 'done' ? await cheatReportSize(r.id) : null }))),
    otherAssignments: (await cheatOtherAssignments(id)).map(a => ({ ...a, archived: Boolean(a.archived) })),
    moss: {
      userId: await getSetting('moss_userid'),
      running: mossIsRunning(id),
      links: await mossProblemLinks(id),
    },
  }
})
