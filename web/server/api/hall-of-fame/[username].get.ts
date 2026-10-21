// Per assignment/problem scores of one user (legacy Halloffame::hof_details).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const username = getRouterParam(event, 'username') ?? ''
  if (!/^[A-Za-z0-9]+$/.test(username))
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return hofDetails(username)
})
