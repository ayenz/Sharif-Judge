// Similarity across all analysed assignments: students and repeated pairs.
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const min = Number(getQuery(event).min)
  return cheatHistory(Number.isFinite(min) && min > 0 && min <= 1 ? min : 0.7)
})
