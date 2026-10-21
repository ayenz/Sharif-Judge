export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  await setSetting('queue_is_working', '0')
  return { ok: true }
})
