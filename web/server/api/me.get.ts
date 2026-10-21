// Current user plus the data every page header needs.
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  if (!user)
    return { user: null }
  return {
    user,
    serverTime: await nowStr(),
  }
})
