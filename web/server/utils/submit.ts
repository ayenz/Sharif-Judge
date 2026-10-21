import { mkdir } from 'node:fs/promises'
import { and, eq, sql } from 'drizzle-orm'
import { languageToType, parseAllowedLanguages } from '#shared/languages'

const { assignments, submissions } = schema

/** Increments assignments.total_submits atomically and returns the new value (the submit id). */
export async function submitNextId(assignmentId: number): Promise<number> {
  return useDb().transaction(async (tx) => {
    await tx.update(assignments).set({ totalSubmits: sql`${assignments.totalSubmits} + 1` }).where(eq(assignments.id, assignmentId))
    const [row] = await tx.select({ total: assignments.totalSubmits }).from(assignments).where(eq(assignments.id, assignmentId))
    return row!.total
  })
}

/** Checks that a submit for `problemId` with `language` is allowed; returns the problem. */
export async function submitCheck(user: CurrentUser, problemId: number, language: string) {
  const assignment = user.selectedAssignment
  const problem = await problemInfo(assignment.id, problemId)
  if (!problem)
    throw createError({ statusCode: 400, statusMessage: 'Select a problem.' })
  if (await queueHasItem(user.username, assignment.id, problem.id))
    throw createError({ statusCode: 409, statusMessage: 'You have already submitted for this problem. Your last submission is still in queue.' })
  const blocked = await submitBlockedReason(assignment, user)
  if (blocked)
    throw createError({ statusCode: 403, statusMessage: blocked === 'Selected assignment is closed.' ? 'Selected assignment has been closed.' : blocked })
  const fileType = languageToType(language)
  const allowed = parseAllowedLanguages(problem.allowedLanguages).map(l => languageToType(l))
  if (!fileType || !allowed.includes(fileType))
    throw createError({ statusCode: 400, statusMessage: 'This file type is not allowed for this problem.' })
  return { assignment, problem, fileType }
}

export async function submitUserDir(user: CurrentUser, problemId: number): Promise<string> {
  const dir = await userDir(user.selectedAssignment.id, problemId, user.username)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  return dir
}

/** Upload-only problems are final immediately with status "Uploaded". */
export async function submitAddUploadOnly(info: Omit<typeof schema.submissions.$inferInsert, 'isFinal' | 'status'>) {
  await useDb().transaction(async (tx) => {
    await tx.update(submissions).set({ isFinal: 0 }).where(and(
      eq(submissions.isFinal, 1),
      eq(submissions.username, info.username),
      eq(submissions.assignment, info.assignment),
      eq(submissions.problem, info.problem),
    ))
    await tx.insert(submissions).values({ ...info, isFinal: 1, status: 'Uploaded' })
  })
}
