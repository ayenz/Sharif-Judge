// Whether a notification newer than `time` exists (legacy notifications/check).
// Also returns the current server time, to be sent as `time` on the next check.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { time } = await readForm(event, z.object({
    time: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'Invalid time.'),
  }))
  return { new: await notificationsNewerThan(time), serverTime: await nowStr() }
})
