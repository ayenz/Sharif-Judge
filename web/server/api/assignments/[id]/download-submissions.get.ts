import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, eq, ne } from 'drizzle-orm'
import { typeToExtension } from '#shared/languages'

const { submissions } = schema

// Zip of final submissions, ?type=by_user|by_problem (legacy download_submissions).
// Like the legacy app this is open to instructors (level >= 1).
export default defineEventHandler(async (event) => {
  await requireUser(event, 1)
  const id = intParam(event, 'id')
  const type = getQuery(event).type
  if (type !== 'by_user' && type !== 'by_problem')
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const items = await useDb().select().from(submissions)
    .where(and(eq(submissions.assignment, id), eq(submissions.isFinal, 1), ne(submissions.submitId, 0)))
    .orderBy(asc(submissions.username), asc(submissions.problem))

  const root = await assignmentDir(id)
  const files: Record<string, Uint8Array> = {}
  for (const item of items) {
    const ext = typeToExtension(item.fileType)
    // Guard against path traversal through stored names.
    if (!ext || !/^[A-Za-z0-9]+$/.test(item.username) || !/^[\w\-().]+$/.test(item.fileName) || item.fileName.includes('..'))
      continue
    const data = await readFile(join(root, `p${item.problem}`, item.username, `${item.fileName}.${ext}`)).catch(() => null)
    if (!data)
      continue
    if (type === 'by_user')
      files[`${item.username}/p${item.problem}.${ext}`] = data
    else
      files[`problem_${item.problem}/${item.username}.${ext}`] = data
  }
  return zipSend(event, `assignment${id}_submissions_${type}_${assignmentFileStamp(await nowStr())}.zip`, files)
})
