import { and, eq } from 'drizzle-orm'

const { submissions } = schema

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const a = user.selectedAssignment
  // Students cannot change their final submission after finish_time + extra_time.
  if (user.level === 0 && (await nowEpoch()) > toEpoch(a.finishTime) + a.extraTime)
    return { done: 0, message: 'This assignment is finished. You cannot change your final submissions.' }

  const form = await readForm(event, z.object({
    submitId: rules.id,
    problem: rules.id,
    username: z.string().regex(/^[a-z0-9]{3,20}$/i),
  }))
  const username = user.level === 0 ? user.username : form.username
  if (!(await submissionFind(username, a.id, form.problem, form.submitId)))
    return { done: 0, message: 'Selecting Final Submission Failed' }

  await useDb().transaction(async (tx) => {
    const same = [eq(submissions.username, username), eq(submissions.assignment, a.id), eq(submissions.problem, form.problem)]
    await tx.update(submissions).set({ isFinal: 0 }).where(and(eq(submissions.isFinal, 1), ...same))
    await tx.update(submissions).set({ isFinal: 1 }).where(and(eq(submissions.submitId, form.submitId), ...same))
  })
  return { done: 1 }
})
