// 10 latest notifications as plain-text excerpts (dashboard widget).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return notificationsLatest()
})
