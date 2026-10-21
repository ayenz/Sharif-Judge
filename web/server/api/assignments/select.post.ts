import { eq } from 'drizzle-orm'

const { users } = schema

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = await readForm(event, z.object({ id: rules.id }))
  await useDb().update(users).set({ selectedAssignment: id }).where(eq(users.username, user.username))
  const assignment = await getAssignment(id)
  return { done: 1, finishTime: assignment.finishTime, extraTime: assignment.extraTime }
})
