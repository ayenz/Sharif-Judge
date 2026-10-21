export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const form = await readForm(event, z.object({
    submitId: rules.id,
    username: z.string().regex(/^[a-z0-9]{1,20}$/i),
    assignment: rules.id,
    problem: rules.id,
  }))
  await queueRejudgeOne(form)
  queueKick()
  return { done: 1 }
})
