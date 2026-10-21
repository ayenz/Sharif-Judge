// All notifications, newest first (everyone).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return notificationsAll()
})
