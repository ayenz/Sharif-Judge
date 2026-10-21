// Raw recording JSON (legacy Recording::download_record).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const assignmentId = intParam(event, 'assignment')
  const problemId = intParam(event, 'problem')
  const recId = intParam(event, 'recId')
  const username = getRouterParam(event, 'username') ?? ''
  const content = await readRecordingFile(assignmentId, problemId, username, recId)
  setResponseHeaders(event, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="rec-${assignmentId}-${problemId}-${username}-${recId}.json"`,
    'Cache-Control': 'no-store',
  })
  return content
})
