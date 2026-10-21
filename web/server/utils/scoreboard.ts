import { and, asc, count, eq } from 'drizzle-orm'

const { submissions, problems } = schema

export interface ScoreboardRow {
  rank: number
  username: string
  displayName: string
  /** Per problem id: final score and seconds since assignment start. */
  scores: Record<number, { score: number, time: number }>
  total: number
  /** Total time plus submit penalty, in seconds. */
  penalty: number
}

export interface Scoreboard {
  problems: { id: number, name: string, score: number }[]
  totalScore: number
  rows: ScoreboardRow[]
}

/**
 * Builds the scoreboard of an assignment from final submissions, with the same
 * ranking as the legacy app: total score desc, then time + penalty asc, then username.
 */
export async function computeScoreboard(assignmentId: number): Promise<Scoreboard> {
  const db = useDb()
  const assignment = await getAssignment(assignmentId)
  const problemRows = await db.select().from(problems).where(eq(problems.assignment, assignmentId)).orderBy(asc(problems.id))
  const problemScore = new Map(problemRows.map(p => [p.id, p.score]))
  const finals = await db.select().from(submissions)
    .where(and(eq(submissions.isFinal, 1), eq(submissions.assignment, assignmentId)))
  const counts = await db.select({ username: submissions.username, problem: submissions.problem, n: count() })
    .from(submissions).where(eq(submissions.assignment, assignmentId))
    .groupBy(submissions.username, submissions.problem)
  const submitCount = new Map(counts.map(c => [`${c.username}/${c.problem}`, c.n]))
  const submitPenalty = Number(await getSetting('submit_penalty'))
  const start = toEpoch(assignment.startTime)
  const names = await getNames()

  const byUser = new Map<string, ScoreboardRow>()
  for (const s of finals) {
    const { finalScore } = computeScores(s.preScore, problemScore.get(s.problem) ?? 0, s.coefficient)
    const delay = toEpoch(s.time) - start
    let row = byUser.get(s.username)
    if (!row) {
      row = { rank: 0, username: s.username, displayName: names[s.username] ?? '', scores: {}, total: 0, penalty: 0 }
      byUser.set(s.username, row)
    }
    row.scores[s.problem] = { score: finalScore, time: delay }
    row.total += finalScore
    row.penalty += delay + (submitCount.get(`${s.username}/${s.problem}`) ?? 0) * submitPenalty
  }

  const rows = [...byUser.values()].sort((a, b) =>
    b.total - a.total || a.penalty - b.penalty || (a.username < b.username ? -1 : a.username > b.username ? 1 : 0))
  rows.forEach((r, i) => (r.rank = i + 1))

  return {
    problems: problemRows.map(p => ({ id: p.id, name: p.name, score: p.score })),
    totalScore: problemRows.reduce((sum, p) => sum + p.score, 0),
    rows,
  }
}
