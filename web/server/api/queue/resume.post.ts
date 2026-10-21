export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  queueKick()
  return { ok: true }
})
