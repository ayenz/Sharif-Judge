import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, count, desc, eq, ne, type SQL } from 'drizzle-orm'
import { typeToExtension, typeToLabel } from '#shared/languages'

const { submissions } = schema

export interface SubmissionQuery {
  view: 'final' | 'all'
  filterUser?: string | null
  filterProblem?: number | null
  /** 1-based page; omit to get every row. */
  page?: number
}

function conditions(user: CurrentUser, q: SubmissionQuery): SQL {
  const conds: SQL[] = [
    eq(submissions.assignment, user.selectedAssignment.id),
    ne(submissions.submitId, EDITOR.submitId),
  ]
  if (q.view === 'final')
    conds.push(eq(submissions.isFinal, 1))
  // Students only ever see their own submissions.
  if (user.level === 0)
    conds.push(eq(submissions.username, user.username))
  else if (q.filterUser)
    conds.push(eq(submissions.username, q.filterUser))
  if (q.filterProblem)
    conds.push(eq(submissions.problem, q.filterProblem))
  return and(...conds)!
}

export async function submissionsPerPage(view: 'final' | 'all'): Promise<number> {
  return Number(await getSetting(view === 'final' ? 'results_per_page_final' : 'results_per_page_all'))
}

/** Rows plus the computed columns the tables show (legacy Submissions::all / the_final). */
export async function submissionsList(user: CurrentUser, q: SubmissionQuery) {
  const where = conditions(user, q)
  const [{ total } = { total: 0 }] = await useDb().select({ total: count() }).from(submissions).where(where)
  let query = useDb().select().from(submissions).where(where)
    .orderBy(...(q.view === 'final'
      ? [asc(submissions.username), asc(submissions.problem)]
      : [desc(submissions.submitId)]))
    .$dynamic()
  const perPage = q.page ? await submissionsPerPage(q.view) : 0
  if (q.page && perPage > 0)
    query = query.limit(perPage).offset((q.page - 1) * perPage)
  const rows = await query

  const problems = await assignmentProblems(user.selectedAssignment.id)
  const names = await getNames()
  const finish = toEpoch(user.selectedAssignment.finishTime)
  const items = rows.map((s) => {
    const { preScore, finalScore } = computeScores(s.preScore, problems[s.problem]?.score ?? 0, s.coefficient)
    return {
      submitId: s.submitId,
      username: s.username,
      name: names[s.username] ?? '',
      assignment: s.assignment,
      problem: s.problem,
      problemName: problems[s.problem]?.name ?? '',
      isFinal: Boolean(s.isFinal),
      time: s.time,
      status: s.status,
      fullmark: s.preScore === 10000,
      preScore,
      coefficient: s.coefficient,
      finalScore,
      delay: toEpoch(s.time) - finish,
      fileType: s.fileType,
      language: typeToLabel(s.fileType),
      isUploadOnly: Boolean(problems[s.problem]?.isUploadOnly),
    }
  })
  return { items, total, perPage: perPage || total }
}

export type SubmissionItem = Awaited<ReturnType<typeof submissionsList>>['items'][number]

export async function submissionFind(username: string, assignment: number, problem: number, submitId: number) {
  const [row] = await useDb().select().from(submissions).where(and(
    eq(submissions.username, username),
    eq(submissions.assignment, assignment),
    eq(submissions.problem, problem),
    eq(submissions.submitId, submitId),
  ))
  return row
}

/** Path of the code, result or log file of a submission. */
export async function submissionFilePath(s: typeof schema.submissions.$inferSelect, type: 'code' | 'result' | 'log') {
  const dir = await userDir(s.assignment, s.problem, s.username)
  if (type === 'result')
    return join(dir, `result-${s.submitId}.html`)
  if (type === 'log')
    return join(dir, `log-${s.submitId}`)
  return join(dir, `${s.fileName}.${typeToExtension(s.fileType)}`)
}

export async function submissionReadFile(s: typeof schema.submissions.$inferSelect, type: 'code' | 'result' | 'log') {
  return readFile(await submissionFilePath(s, type), 'utf8').catch(() => 'File Not Found')
}

/** Reads `user`, `problem` and `page` filters from the query string. */
export function submissionsQuery(event: import('h3').H3Event, view: 'final' | 'all'): SubmissionQuery {
  const query = getQuery(event)
  const user = typeof query.user === 'string' && /^[a-z0-9]+$/i.test(query.user) ? query.user : null
  const problem = Number(query.problem)
  const page = Number(query.page)
  return {
    view,
    filterUser: user,
    filterProblem: Number.isInteger(problem) && problem > 0 ? problem : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
