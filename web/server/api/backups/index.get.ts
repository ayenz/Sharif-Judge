export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  return backupStatus()
})
