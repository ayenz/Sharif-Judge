export default defineEventHandler(async (event) => {
  await requireUser(event, 3)
  const form = await readForm(event, z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 02:00.'),
    keepDays: z.coerce.number().int().min(1, 'Keep backups at least 1 day.').max(365, 'Keep backups at most 365 days.'),
  }))
  if (!(await backupStatus()).configured)
    throw createError({ statusCode: 503, statusMessage: 'The backup service is not configured.' })
  await backupSetSchedule(form.time, form.keepDays)
  return { ok: true }
})
