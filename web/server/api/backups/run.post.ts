export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const status = await backupStatus()
  if (!status.configured || !status.running)
    throw createError({ statusCode: 503, statusMessage: 'The backup service is not running.' })
  if (status.last?.status === 'running' || status.runRequested)
    throw createError({ statusCode: 409, statusMessage: 'A backup is already in progress.' })
  await backupRequestRun()
  return { ok: true }
})
