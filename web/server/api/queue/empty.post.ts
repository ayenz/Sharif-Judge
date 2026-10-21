export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  await queueEmpty()
  return { ok: true }
})
