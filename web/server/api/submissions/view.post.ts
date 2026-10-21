import { typeToExtension } from '#shared/languages'

// Code, judge result or log of one submission (legacy Submissions::view_code).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const form = await readForm(event, z.object({
    type: z.enum(['code', 'result', 'log']),
    username: z.string().regex(/^[a-z0-9]{3,20}$/i),
    assignment: rules.id,
    problem: rules.id,
    submitId: rules.id,
  }))
  const s = await submissionFind(form.username, form.assignment, form.problem, form.submitId)
  if (!s)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (user.level === 0 && form.type === 'log')
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (user.level === 0 && user.username !== s.username)
    throw createError({ statusCode: 403, statusMessage: 'You can only see your own submissions.' })

  const ext = typeToExtension(s.fileType)
  return {
    fileName: `${s.mainFileName}.${ext}`,
    text: await submissionReadFile(s, form.type),
    lang: form.type === 'code' ? (s.fileType.startsWith('py') ? 'python' : s.fileType) : undefined,
  }
})
