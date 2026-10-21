export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const id = intParam(event, 'assignment')
  const q = getQuery(event)
  const problem = Number(q.problem) || undefined
  const minSimilarity = Math.min(1, Math.max(0, Number(q.min) || 0))
  return cheatPairsList(id, { problem, minSimilarity, limit: 1000 })
})
