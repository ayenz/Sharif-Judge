// Description source for the editors: ?type=md (desc.md) or html/plain (desc.html).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const { assignment, problemId } = await problemFromParams(event)
  const type = getQuery(event).type
  if (type !== 'md' && type !== 'html' && type !== 'plain')
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const text = await problemReadDescription(assignment.id, problemId, type === 'md' ? 'md' : 'html')
  return {
    assignment: { id: assignment.id, name: assignment.name },
    problem: { id: problemId, name: (await problemInfo(assignment.id, problemId))?.name ?? '' },
    text: text ?? '',
    hasMarkdown: type === 'md' ? text !== null : (await problemReadDescription(assignment.id, problemId, 'md')) !== null,
  }
})
