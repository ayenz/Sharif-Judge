import { and, asc, eq, notInArray, sql } from 'drizzle-orm'

const { submissions } = schema

// Upload-only files are not counted (same as the legacy Hof_model).
const HOF_EXCLUDED_TYPES = ['txt', 'pdf', 'zip']

export interface HofEntry {
  rank: number
  username: string
  displayName: string
  totalScore: number
}

export interface HofAssignmentDetail {
  id: number
  name: string
  /** False when the assignment's scoreboard is disabled: scores are then hidden. */
  scoreboard: boolean
  problems: { id: number, name: string, score: number | null }[]
}

/**
 * Hall of Fame ranking: CEILING(SUM(pre_score * coefficient / 10000)) over all final
 * submissions, ordered by total score. Ties share a rank and the next rank skips
 * (1, 2, 2, 4), like the legacy halloffame.twig.
 */
export async function hofRanking(): Promise<HofEntry[]> {
  const [rows] = await usePool().query(
    `SELECT username, CEILING(SUM(pre_score * coefficient / 10000)) AS totalscore
     FROM ${tableName('submissions')}
     WHERE is_final = 1 AND file_type NOT IN (?)
     GROUP BY username
     ORDER BY totalscore DESC, username ASC`,
    [HOF_EXCLUDED_TYPES],
  )
  const names = await getNames()
  let rank = 0
  let previous: number | null = null
  return (rows as { username: string, totalscore: number | string | null }[]).map((r, i) => {
    const totalScore = Number(r.totalscore ?? 0)
    if (totalScore !== previous) {
      rank = i + 1
      previous = totalScore
    }
    return { rank, username: r.username, displayName: names[r.username] ?? '', totalScore }
  })
}

/**
 * Per assignment/problem scores of one user (legacy hof_details). Scores of assignments
 * whose scoreboard is disabled are not sent at all (legacy sent them and only hid them in JS).
 */
export async function hofDetails(username: string): Promise<HofAssignmentDetail[]> {
  // Parameterized: the legacy query concatenated the username into SQL.
  const rows = await useDb().select({
    assignment: submissions.assignment,
    problem: submissions.problem,
    score: sql<number>`CEILING(${submissions.preScore} * ${submissions.coefficient} / 10000)`,
  }).from(submissions)
    .where(and(
      eq(submissions.isFinal, 1),
      eq(submissions.username, username),
      notInArray(submissions.fileType, HOF_EXCLUDED_TYPES),
    ))
    .orderBy(asc(submissions.assignment), asc(submissions.problem))

  const assignmentRows = await allAssignments()
  const assignmentById = new Map(assignmentRows.map(a => [a.id, a]))
  const problemNames = new Map<number, Record<number, Problem>>()

  const result: HofAssignmentDetail[] = []
  for (const row of rows) {
    const a = assignmentById.get(row.assignment)
    let group = result.at(-1)
    if (!group || group.id !== row.assignment) {
      group = { id: row.assignment, name: a?.name ?? '', scoreboard: Boolean(a?.scoreboard), problems: [] }
      result.push(group)
    }
    if (!problemNames.has(row.assignment))
      problemNames.set(row.assignment, await assignmentProblems(row.assignment))
    group.problems.push({
      id: row.problem,
      name: problemNames.get(row.assignment)?.[row.problem]?.name ?? `Problem ${row.problem}`,
      score: group.scoreboard ? Number(row.score ?? 0) : null,
    })
  }
  return result
}
