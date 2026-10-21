import { CHEAT_LANGUAGES } from '#shared/cheat'

// Saves (or clears, when empty) the template code of a problem for one language.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const assignment = intParam(event, 'assignment')
  const problem = intParam(event, 'problem')
  if (!(await problemInfo(assignment, problem)))
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })
  const form = await readForm(event, z.object({
    language: z.enum(CHEAT_LANGUAGES),
    content: z.string().max(256 * 1024),
  }))
  await cheatSaveBaseCode(assignment, problem, form.language, form.content)
  return { ok: true }
})
