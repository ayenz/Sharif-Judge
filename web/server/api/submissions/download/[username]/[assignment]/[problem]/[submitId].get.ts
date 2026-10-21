import { readFile } from 'node:fs/promises'
import { typeToExtension } from '#shared/languages'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const username = getRouterParam(event, 'username') ?? ''
  if (!/^[a-z0-9]{1,20}$/i.test(username))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const s = await submissionFind(username, intParam(event, 'assignment'), intParam(event, 'problem'), intParam(event, 'submitId'))
  if (!s)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (user.level === 0 && user.username !== s.username)
    throw createError({ statusCode: 403, statusMessage: 'You can only download your own submissions.' })
  const data = await readFile(await submissionFilePath(s, 'code')).catch(() => null)
  if (!data)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  setResponseHeaders(event, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${s.fileName}.${typeToExtension(s.fileType)}"`,
  })
  return data
})
