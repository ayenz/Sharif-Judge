import type { H3Event } from 'h3'
import { join } from 'node:path'
import vm from 'node:vm'
import { and, asc, eq, sql } from 'drizzle-orm'
import { ALL_LANGUAGES, JUDGED_LANGUAGES, parseAllowedLanguages } from '#shared/languages'

const { problems, assignments, submissions } = schema

export type Problem = typeof schema.problems.$inferSelect

export async function assignmentsRoot(): Promise<string> {
  return (await getSetting('assignments_root')).replace(/\/+$/, '')
}

export async function testerPath(): Promise<string> {
  return (await getSetting('tester_path')).replace(/\/+$/, '')
}

/** <root>/assignment_<id> */
export async function assignmentDir(assignmentId: number): Promise<string> {
  return join(await assignmentsRoot(), `assignment_${Number(assignmentId)}`)
}

/** <root>/assignment_<id>/p<problem> */
export async function problemDir(assignmentId: number, problemId: number): Promise<string> {
  return join(await assignmentDir(assignmentId), `p${Number(problemId)}`)
}

/** <root>/assignment_<id>/p<problem>/<username>; the username must already be validated. */
export async function userDir(assignmentId: number, problemId: number, username: string): Promise<string> {
  if (!/^[A-Za-z0-9]+$/.test(username))
    throw createError({ statusCode: 400, statusMessage: 'Invalid username' })
  return join(await problemDir(assignmentId, problemId), username)
}

/** Problems of an assignment keyed by problem id (like the legacy all_problems). */
export async function assignmentProblems(assignmentId: number): Promise<Record<number, Problem>> {
  const rows = await useDb().select().from(problems).where(eq(problems.assignment, assignmentId)).orderBy(asc(problems.id))
  return Object.fromEntries(rows.map(p => [p.id, p]))
}

export async function problemInfo(assignmentId: number, problemId: number): Promise<Problem | undefined> {
  const [row] = await useDb().select().from(problems)
    .where(and(eq(problems.assignment, assignmentId), eq(problems.id, problemId)))
  return row
}

export async function allAssignments() {
  return useDb().select().from(assignments).orderBy(asc(assignments.id))
}

/** "ALL" or a comma separated list of usernames. */
export function isParticipant(participants: string, username: string): boolean {
  const list = participants.split(',').map(p => p.trim())
  return list.includes('ALL') || list.includes(username)
}

/**
 * Why a user cannot submit to an assignment right now, or null if they can.
 * Same checks and messages as the legacy Submit controller.
 */
export async function submitBlockedReason(assignment: Assignment, user: { username: string, level: number }): Promise<string | null> {
  const now = await nowEpoch()
  if (!assignment.id)
    return 'Please select an assignment first.'
  if (user.level === 0 && !assignment.open)
    return 'Selected assignment is closed.'
  if (now < toEpoch(assignment.startTime))
    return 'Selected assignment has not started.'
  if (now > toEpoch(assignment.finishTime) + assignment.extraTime)
    return 'Selected assignment has finished.'
  if (!isParticipant(assignment.participants, user.username))
    return 'You are not registered for submitting.'
  return null
}

/** Late coefficient for a submission made now to this assignment. */
export async function currentCoefficient(assignment: Assignment): Promise<string> {
  const delay = (await nowEpoch()) - toEpoch(assignment.finishTime)
  return evalLateRule(assignment.lateRule, delay, assignment.extraTime)
}

// ---------------------------------------------------------------------------
// Add / edit / delete (legacy Assignment_model)

export interface AssignmentInput {
  name: string
  startTime: string
  finishTime: string
  /** Seconds. */
  extraTime: number
  participants: string
  lateRule: string
  open: boolean
  scoreboard: boolean
  javaexceptions: boolean
  archived: boolean
  problems: {
    name: string
    score: number
    cTimeLimit: number
    pythonTimeLimit: number
    javaTimeLimit: number
    memoryLimit: number
    /** Already normalized, comma separated. */
    allowedLanguages: string
    diffCmd: string
    diffArg: string
    isUploadOnly: boolean
  }[]
}

/** Syntax error message of a late rule after translation to JavaScript, or null. */
export function assignmentLateRuleError(rule: string): string | null {
  try {
    // eslint-disable-next-line no-new
    new vm.Script(lateRuleToJs(rule))
    return null
  }
  catch (e) {
    return (e as Error).message
  }
}

/**
 * Normalizes allowed languages like the legacy add_assignment: known names only and,
 * unless the problem is upload-only, only judged languages.
 */
export function assignmentNormalizeLanguages(languages: string[], uploadOnly: boolean, python2 = true): string {
  const out: string[] = []
  for (const raw of languages) {
    const lower = raw.trim().toLowerCase()
    const name = lower === 'python2' ? 'Python 2' : lower === 'python3' ? 'Python 3' : ALL_LANGUAGES.find(l => l.toLowerCase() === lower)
    if (!name)
      continue
    if (!uploadOnly && !JUDGED_LANGUAGES.includes(name))
      continue
    if (name === 'Python 2' && !python2)
      continue
    if (!out.includes(name))
      out.push(name)
  }
  return out.join(',')
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Recomputes the late coefficient of every submission of an assignment (legacy
 * _update_coefficients), with parameterized batched updates instead of string SQL.
 */
async function updateCoefficients(tx: Tx, assignmentId: number, extraTime: number, finishTime: string, lateRule: string): Promise<void> {
  const rows = await tx.select({
    submitId: submissions.submitId,
    username: submissions.username,
    problem: submissions.problem,
    time: submissions.time,
  }).from(submissions).where(eq(submissions.assignment, assignmentId))
  const finish = toEpoch(finishTime)
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const cases = chunk.map(r => sql`WHEN ${submissions.problem} = ${r.problem} AND ${submissions.username} = ${r.username} AND ${submissions.submitId} = ${r.submitId} THEN ${evalLateRule(lateRule, toEpoch(r.time) - finish, extraTime)}`)
    await tx.update(submissions)
      .set({ coefficient: sql`CASE ${sql.join(cases, sql` `)} ELSE ${submissions.coefficient} END` })
      .where(eq(submissions.assignment, assignmentId))
  }
}

/** Inserts or updates an assignment and replaces its problems, in one transaction. */
/**
 * An assignment and its problems in the shape of the add/edit form (AssignmentFormBody).
 * Used by the edit form and by the assignment.json of an export. Python 2 is left out while it
 * is disabled in Settings.
 */
export async function assignmentFormValues(a: Assignment, python2: boolean) {
  const problems = Object.values(await assignmentProblems(a.id))
  return {
    name: a.name,
    startTime: a.startTime,
    finishTime: a.finishTime,
    extraTime: extraTimeFormat(a.extraTime),
    participants: a.participants,
    lateRule: a.lateRule,
    open: Boolean(a.open),
    scoreboard: Boolean(a.scoreboard),
    javaexceptions: Boolean(a.javaexceptions),
    archived: Boolean(a.archivedAssignment),
    problems: problems.map(p => ({
      name: p.name,
      score: p.score,
      cTimeLimit: p.cTimeLimit,
      pythonTimeLimit: p.pythonTimeLimit,
      javaTimeLimit: p.javaTimeLimit,
      memoryLimit: p.memoryLimit,
      languages: parseAllowedLanguages(p.allowedLanguages).filter(l => python2 || l !== 'Python 2'),
      diffCmd: p.diffCmd,
      diffArg: p.diffArg,
      isUploadOnly: Boolean(p.isUploadOnly),
    })),
  }
}

export async function assignmentSave(id: number, input: AssignmentInput, edit: boolean): Promise<void> {
  await useDb().transaction(async (tx) => {
    const values = {
      name: input.name,
      problems: input.problems.length,
      open: input.open ? 1 : 0,
      scoreboard: input.scoreboard ? 1 : 0,
      javaexceptions: input.javaexceptions ? 1 : 0,
      description: '',
      startTime: input.startTime,
      finishTime: input.finishTime,
      extraTime: input.extraTime,
      lateRule: input.lateRule,
      participants: input.participants,
      archivedAssignment: input.archived ? 1 : 0,
    }
    if (edit) {
      const [before] = await tx.select().from(assignments).where(eq(assignments.id, id))
      if (!before)
        throw createError({ statusCode: 404, statusMessage: 'Not Found' })
      await tx.update(assignments).set(values).where(eq(assignments.id, id))
      if (before.extraTime !== values.extraTime || before.startTime !== values.startTime
        || before.finishTime !== values.finishTime || before.lateRule !== values.lateRule)
        await updateCoefficients(tx, id, values.extraTime, values.finishTime, values.lateRule)
    }
    else {
      await tx.insert(assignments).values({ id, totalSubmits: 0, ...values })
    }

    await tx.delete(problems).where(eq(problems.assignment, id))
    await tx.insert(problems).values(input.problems.map((p, i) => ({
      assignment: id,
      id: i + 1,
      name: p.name,
      score: p.score,
      isUploadOnly: p.isUploadOnly ? 1 : 0,
      cTimeLimit: p.cTimeLimit,
      pythonTimeLimit: p.pythonTimeLimit,
      javaTimeLimit: p.javaTimeLimit,
      memoryLimit: p.memoryLimit,
      allowedLanguages: p.allowedLanguages,
      diffCmd: p.diffCmd,
      diffArg: p.diffArg,
    })))
  })
}

/** Deletes the assignment rows (transaction), then its folder (legacy delete_assignment). */
export async function assignmentDelete(id: number): Promise<void> {
  await useDb().transaction(async (tx) => {
    await tx.delete(assignments).where(eq(assignments.id, id))
    await tx.delete(problems).where(eq(problems.assignment, id))
    await tx.delete(submissions).where(eq(submissions.assignment, id))
  })
  await assignmentRemoveFolder(id)
}

/** Resolves :assignment/:problem route params to an existing problem, or throws 404. */
export async function problemFromParams(event: H3Event): Promise<{ assignment: Assignment, problemId: number }> {
  const assignment = await getAssignment(intParam(event, 'assignment'))
  const problemId = intParam(event, 'problem')
  if (!assignment.id || problemId < 1 || problemId > assignment.problems)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return { assignment, problemId }
}
