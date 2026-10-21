// Queues JPlag runs for the assignment (all problems, or the listed ones).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'assignment')
  if (!(await getAssignment(id)).id)
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  if (!(await cheatEngineAvailable()))
    throw createError({ statusCode: 503, statusMessage: 'The JPlag engine is not installed on this server.' })
  const form = await readForm(event, z.object({
    problems: z.array(z.number().int().positive()).optional(),
    compareAssignments: z.array(z.number().int().positive()).max(50).default([]),
    minTokens: z.number().int().min(3).max(100).nullable().default(null),
  }))
  const runIds = await cheatQueueRuns(id, form)
  if (!runIds.length)
    throw createError({ statusCode: 400, statusMessage: 'Nothing to compare: each problem needs at least two code submissions in the same language.' })
  return { runIds }
})
