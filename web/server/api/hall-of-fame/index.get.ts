// Hall of Fame ranking across all assignments (legacy Halloffame::index).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return hofRanking()
})
