import { createReadStream } from 'node:fs'
import { basename } from 'node:path'

// Assignment PDF, or a problem PDF with ?problem=N (legacy Assignments::pdf).
// Shown inline by default; ?download=1 forces a download.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = intParam(event, 'id')
  const query = getQuery(event)
  const problem = query.problem !== undefined && query.problem !== 'null' ? Number(query.problem) : null
  if (problem !== null && (!Number.isInteger(problem) || problem < 1))
    throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const assignment = await getAssignment(id)
  const path = assignment.id ? await assignmentPdfPath(id, problem) : null
  if (!path)
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  const reason = await assignmentPdfBlockedReason(assignment, user)
  if (reason)
    throw createError({ statusCode: 403, statusMessage: reason })

  const name = basename(path).replace(/"/g, '')
  const download = query.download === '1' || query.download === 'true'
  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
    'Cache-Control': 'private, no-store',
  })
  return sendStream(event, createReadStream(path))
})
