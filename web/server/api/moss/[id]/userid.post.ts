// Saves the Moss user id and regenerates <tester_path>/moss (legacy Moss::update).
export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  intParam(event, 'id')
  // The id is pasted into a Perl script ($userid=MOSS_USER_ID;), so only digits are
  // accepted. The legacy app accepted anything, which allowed code injection.
  const { mossUserId } = await readForm(event, z.object({
    mossUserId: z.string().trim().regex(/^\d{1,20}$/, 'Moss user id must be a number.'),
  }))
  try {
    await mossSaveUserId(mossUserId)
  }
  catch (error) {
    throw validationError({ mossUserId: `Cannot write the moss script: ${(error as Error).message}` })
  }
  return { ok: true }
})
