import { readFile } from 'node:fs/promises'
import { CHEAT_LANGUAGES } from '#shared/cheat'

// Template code of a problem, per language.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const assignment = intParam(event, 'assignment')
  const problem = intParam(event, 'problem')
  if (!(await problemInfo(assignment, problem)))
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })
  const result: Record<string, string> = {}
  for (const lang of CHEAT_LANGUAGES)
    result[lang] = await readFile(await cheatBaseCodePath(assignment, problem, lang), 'utf8').catch(() => '')
  return result
})
