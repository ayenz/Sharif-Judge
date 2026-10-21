import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { eq } from 'drizzle-orm'

// Raw JPlag report, which can be opened in the official JPlag report viewer.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'id')
  const [run] = await useDb().select().from(schema.cheatRuns).where(eq(schema.cheatRuns.id, id))
  const path = await cheatReportPath(id)
  if (!run || !(await access(path).then(() => true, () => false)))
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="assignment${run.assignment}-p${run.problem}-${run.language}.jplag"`,
  })
  return sendStream(event, createReadStream(path))
})
