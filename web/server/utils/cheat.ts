import { execFile } from 'node:child_process'
import { access, copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { unzipSync } from 'fflate'
import {
  type CheatLanguage,
  type CheatMatch,
  type CheatPair,
  type CheatPairDetail,
  type CheatRun,
  type CheatRunOptions,
  type CheatStudentSignal,
  type CheatSubmissionRef,
  CHEAT_LANGUAGES,
  cheatLanguageExtension,
  fileTypeToCheatLanguage,
} from '#shared/cheat'
import { typeToExtension } from '#shared/languages'

const { cheatRuns, cheatPairs, submissions, assignments, recording } = schema

/** Pairs below this average similarity are not stored. */
const STORE_MIN_SIMILARITY = 0.05
/**
 * A pair whose longest common section is this short is only scattered fragments
 * (common with very short programs), unless the overall similarity is high.
 */
const FRAGMENT_LONGEST_MATCH = 6
const FRAGMENT_MAX_SIMILARITY = 0.6
const JPLAG_TIMEOUT_MS = 15 * 60 * 1000
/** JPlag's default minimum match length per language. */
const DEFAULT_MIN_TOKENS: Record<CheatLanguage, number> = { c: 12, cpp: 12, java: 9, python3: 12 }
/** Below this a match is too small to mean anything (3 already flags unrelated code). */
const LOWEST_MIN_TOKENS = 4

/**
 * Minimum match length suited to the programs' size: intro exercises are often only
 * ~25 tokens long, where the default of 12 misses copies with reordered functions.
 */
function adaptiveMinTokens(language: CheatLanguage, medianTokens: number): number {
  return Math.max(LOWEST_MIN_TOKENS, Math.min(DEFAULT_MIN_TOKENS[language], Math.floor(medianTokens / 6)))
}

type SubmissionRow = typeof schema.submissions.$inferSelect

// ---------------------------------------------------------------------------
// Configuration and files

function config() {
  const { cheat } = useRuntimeConfig()
  return {
    java: cheat.java || 'java',
    jar: cheat.jplagJar || '',
    workDir: cheat.workDir || join(tmpdir(), 'shj-cheat'),
  }
}

export async function cheatEngineAvailable(): Promise<boolean> {
  const { jar } = config()
  return !!jar && await access(jar).then(() => true, () => false)
}

/** Template code instructors give to everyone; matches inside it are ignored. */
export async function cheatBaseCodePath(assignmentId: number, problemId: number, language: CheatLanguage): Promise<string> {
  return join(await problemDir(assignmentId, problemId), 'basecode', `template.${cheatLanguageExtension(language)}`)
}

export async function cheatReportPath(runId: number): Promise<string> {
  return join(config().workDir, 'reports', `run-${runId}.jplag`)
}

async function submissionCodePath(s: Pick<SubmissionRow, 'assignment' | 'problem' | 'username' | 'fileName' | 'fileType'>): Promise<string> {
  return join(await userDir(s.assignment, s.problem, s.username), `${s.fileName}.${typeToExtension(s.fileType)}`)
}

const exists = (path: string) => access(path).then(() => true, () => false)

// ---------------------------------------------------------------------------
// Queueing runs

/** Final, judged-or-uploaded code submissions of an assignment (editor runs excluded). */
async function finalCodeSubmissions(assignmentIds: number[]): Promise<SubmissionRow[]> {
  if (!assignmentIds.length)
    return []
  const rows = await useDb().select().from(submissions).where(and(
    inArray(submissions.assignment, assignmentIds),
    eq(submissions.isFinal, 1),
    ne(submissions.submitId, EDITOR.submitId),
  )).orderBy(asc(submissions.username))
  return rows.filter(r => fileTypeToCheatLanguage(r.fileType) && /^[A-Za-z0-9]+$/.test(r.username))
}

function toRun(row: typeof schema.cheatRuns.$inferSelect): CheatRun {
  const parse = <T>(text: string, fallback: T): T => {
    try {
      return JSON.parse(text) as T
    }
    catch {
      return fallback
    }
  }
  return {
    ...row,
    language: row.language as CheatLanguage,
    status: row.status as CheatRun['status'],
    options: parse<CheatRunOptions>(row.options, { minTokens: null, compareAssignments: [], baseCode: false }),
    failed: parse<string[]>(row.failed, []),
  }
}

/** Latest run of every (problem, language) of an assignment. */
export async function cheatLatestRuns(assignmentId: number): Promise<CheatRun[]> {
  const rows = await useDb().select().from(cheatRuns).where(eq(cheatRuns.assignment, assignmentId)).orderBy(desc(cheatRuns.id))
  const seen = new Set<string>()
  const latest: CheatRun[] = []
  for (const row of rows) {
    const key = `${row.problem}/${row.language}`
    if (!seen.has(key)) {
      seen.add(key)
      latest.push(toRun(row))
    }
  }
  return latest.sort((a, b) => a.problem - b.problem || a.language.localeCompare(b.language))
}

/**
 * Queues one run per problem and language that has something to compare.
 * Returns the new run ids; the worker processes them one at a time.
 */
export async function cheatQueueRuns(assignmentId: number, input: { problems?: number[], compareAssignments: number[], minTokens: number | null }): Promise<number[]> {
  const finals = await finalCodeSubmissions([assignmentId])
  const others = await finalCodeSubmissions(input.compareAssignments.filter(id => id !== assignmentId))
  const ids: number[] = []
  const problems = await assignmentProblems(assignmentId)
  for (const problem of Object.values(problems)) {
    if (input.problems?.length && !input.problems.includes(problem.id))
      continue
    for (const language of CHEAT_LANGUAGES) {
      const current = finals.filter(s => s.problem === problem.id && fileTypeToCheatLanguage(s.fileType) === language)
      const older = others.filter(s => fileTypeToCheatLanguage(s.fileType) === language)
      if (!current.length || current.length + older.length < 2)
        continue
      const options: CheatRunOptions = {
        minTokens: input.minTokens,
        compareAssignments: input.compareAssignments,
        baseCode: await exists(await cheatBaseCodePath(assignmentId, problem.id, language)),
      }
      const [res] = await useDb().insert(cheatRuns).values({
        assignment: assignmentId,
        problem: problem.id,
        language,
        status: 'queued',
        options: JSON.stringify(options),
        createdAt: await nowStr(),
        failed: '[]',
        error: '',
      }).$returningId()
      ids.push(res!.id)
    }
  }
  cheatKick()
  return ids
}

let working = false

export function cheatIsWorking() {
  return working
}

/** Processes queued runs in the background, one at a time. */
export function cheatKick() {
  if (working)
    return
  working = true
  ;(async () => {
    for (;;) {
      const [next] = await useDb().select().from(cheatRuns).where(eq(cheatRuns.status, 'queued')).orderBy(asc(cheatRuns.id)).limit(1)
      if (!next)
        break
      const notify = async (status: string) => livePublish({ type: 'cheat', assignment: next.assignment, runId: next.id, status }, { minLevel: 2 })
      await notify('running')
      await executeRun(toRun(next))
      const [after] = await useDb().select({ status: cheatRuns.status }).from(cheatRuns).where(eq(cheatRuns.id, next.id))
      await notify(after?.status ?? 'failed')
    }
  })()
    .catch(error => console.error('[cheat] worker stopped:', error))
    .finally(() => (working = false))
}

// ---------------------------------------------------------------------------
// Running JPlag

interface Entry { id: string, row: SubmissionRow, old: boolean }

async function executeRun(run: CheatRun) {
  const db = useDb()
  await db.update(cheatRuns).set({ status: 'running' }).where(eq(cheatRuns.id, run.id))
  const dir = join(config().workDir, `run-${run.id}`)
  try {
    const current = (await finalCodeSubmissions([run.assignment]))
      .filter(s => s.problem === run.problem && fileTypeToCheatLanguage(s.fileType) === run.language)
    const older = (await finalCodeSubmissions(run.options.compareAssignments.filter(id => id !== run.assignment)))
      .filter(s => fileTypeToCheatLanguage(s.fileType) === run.language)
    const hasOld = older.length > 0

    // JPlag names submissions after their folder; with -old it prefixes the root folder name.
    const entries: Entry[] = []
    const ext = cheatLanguageExtension(run.language)
    const place = async (root: string, name: string, row: SubmissionRow, old: boolean) => {
      const source = await submissionCodePath(row)
      if (!(await exists(source)))
        return
      const fileBase = /^[\w-]+$/.test(row.mainFileName) ? row.mainFileName : 'main'
      await mkdir(join(dir, root, name), { recursive: true })
      await copyFile(source, join(dir, root, name, `${fileBase}.${ext}`))
      entries.push({ id: hasOld ? `${root}_${name}` : name, row, old })
    }
    for (const row of current)
      await place('new', row.username, row, false)
    for (const row of older)
      await place('old', `a${row.assignment}p${row.problem}-${row.username}`, row, true)
    if (entries.filter(e => !e.old).length < 1 || entries.length < 2)
      throw new Error('Not enough submissions with code files to compare.')

    const common = ['-Xmx1g', '-jar', config().jar, '-l', run.language, '-M', 'RUN', '-n', '-1', '--overwrite', '--match-merging', '--cluster-skip', '-r', join(dir, 'result')]
    if (run.language === 'java' || run.language === 'cpp')
      common.push('--normalize')
    if (hasOld)
      common.push('-old', join(dir, 'old'))
    let baseArgs: string[] = []
    const base = await cheatBaseCodePath(run.assignment, run.problem, run.language)
    if (await exists(base)) {
      await mkdir(join(dir, 'base'), { recursive: true })
      await copyFile(base, join(dir, 'base', `template.${ext}`))
      baseArgs = ['-bc', join(dir, 'base')]
    }

    const notes: string[] = []
    const reportFile = join(dir, 'result.jplag')
    const jplag = async (minTokens: number | null) => {
      const t = minTokens ? ['-t', String(minTokens)] : []
      await rm(reportFile, { force: true })
      let log = await runJava([...common, ...t, ...baseArgs, join(dir, 'new')], dir)
      // JPlag refuses template code shorter than the minimum match; retry without it.
      if (baseArgs.length && /Submission base contains \d+ tokens/.test(log)) {
        notes.push('The template code is too short to be used, so it was ignored.')
        baseArgs = []
        log = await runJava([...common, ...t, join(dir, 'new')], dir)
      }
      return { log, ok: await exists(reportFile) }
    }

    let minTokens = run.options.minTokens
    let attempt = await jplag(minTokens)
    if (!minTokens) {
      // Short programs: lower the minimum match length once, based on their size.
      const median = attempt.ok
        ? medianNewTokens(new Uint8Array(await readFile(reportFile)), entries)
        : (/Not enough valid submissions/.test(attempt.log) ? 0 : null)
      if (median !== null) {
        const adaptive = adaptiveMinTokens(run.language, median)
        if (adaptive < DEFAULT_MIN_TOKENS[run.language]) {
          minTokens = adaptive
          notes.push(`The programs are short, so sensitivity was raised automatically (matches of ${adaptive}+ tokens).`)
          attempt = await jplag(minTokens)
        }
      }
    }
    if (!attempt.ok) {
      // Every program was shorter than the minimum match length: nothing to compare.
      if (/Not enough valid submissions/.test(attempt.log)) {
        await db.update(cheatRuns).set({
          status: 'done',
          finishedAt: await nowStr(),
          submissions: entries.length,
          failed: JSON.stringify(entries.map(e => e.old ? `${e.row.username} (older)` : e.row.username)),
          error: [...notes, 'The programs are too short to compare reliably.'].join(' '),
        }).where(eq(cheatRuns.id, run.id))
        await pruneOlderRuns(run)
        return
      }
      throw new Error(lastLines(attempt.log) || 'JPlag did not produce a report.')
    }

    const { pairs, failed, comparisons } = parseReport(new Uint8Array(await readFile(reportFile)), entries)
    await mkdir(join(config().workDir, 'reports'), { recursive: true })
    await copyFile(reportFile, await cheatReportPath(run.id))

    await db.transaction(async (tx) => {
      for (let i = 0; i < pairs.length; i += 500)
        await tx.insert(cheatPairs).values(pairs.slice(i, i + 500).map(p => ({ ...p, runId: run.id })))
      await tx.update(cheatRuns).set({
        status: 'done',
        finishedAt: await nowStr(),
        submissions: entries.length,
        comparisons,
        failed: JSON.stringify(failed),
        error: notes.join(' '),
      }).where(eq(cheatRuns.id, run.id))
    })
    await pruneOlderRuns(run)
  }
  catch (error) {
    console.warn(`[cheat] run ${run.id} failed:`, (error as Error).message)
    await db.update(cheatRuns).set({ status: 'failed', finishedAt: await nowStr(), error: (error as Error).message.slice(0, 2000) })
      .where(eq(cheatRuns.id, run.id))
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function runJava(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(config().java, args, { cwd, timeout: JPLAG_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve(`${stdout ?? ''}\n${stderr ?? ''}${error ? `\n${error.message}` : ''}`)
    })
  })
}

function lastLines(text: string): string {
  return text.split('\n').filter(l => /error|exception/i.test(l)).slice(-3).join('\n').slice(0, 1000)
}

interface JplagComparison {
  firstSubmissionId: string
  secondSubmissionId: string
  similarities: { AVG: number, MAX: number, LONGEST_MATCH: number }
  matches: { startInFirst: { line: number }, endInFirst: { line: number }, startInSecond: { line: number }, endInSecond: { line: number }, lengthOfFirst: number }[]
}

/** Median token count of the current assignment's submissions in a JPlag report. */
function medianNewTokens(zip: Uint8Array, entries: Entry[]): number | null {
  const files = unzipSync(zip, { filter: f => f.name === 'submissionFileIndex.json' })
  const data = files['submissionFileIndex.json']
  if (!data)
    return null
  const index = JSON.parse(new TextDecoder().decode(data)).fileIndexes as Record<string, Record<string, { tokenCount: number }>>
  const current = new Set(entries.filter(e => !e.old).map(e => e.id))
  const counts = Object.entries(index)
    .filter(([id]) => current.has(id) || current.has(id.replace('/', '_')))
    .map(([, files]) => Object.values(files).reduce((sum, f) => sum + f.tokenCount, 0))
    .sort((a, b) => a - b)
  return counts.length ? counts[Math.floor(counts.length / 2)]! : null
}

function parseReport(zip: Uint8Array, entries: Entry[]) {
  const files = unzipSync(zip, { filter: f => f.name.startsWith('comparisons/') || f.name === 'runInformation.json' })
  const text = (name: string) => new TextDecoder().decode(files[name])
  const byId = new Map(entries.map(e => [e.id, e]))

  const info = files['runInformation.json'] ? JSON.parse(text('runInformation.json')) : {}
  const failed: string[] = (info.failedSubmissions ?? []).map((f: unknown) =>
    typeof f === 'string' ? f : String((f as { submissionId?: string }).submissionId ?? f))
    .map((id: string) => {
      const entry = byId.get(id) ?? byId.get(id.replace('/', '_')) ?? entries.find(e => id.endsWith(`/${e.id}`) || id.endsWith(`/${e.id.replace(/^(new|old)_/, '')}`))
      return entry ? (entry.old ? `${entry.row.username} (older)` : entry.row.username) : id
    })

  const pairs: Omit<typeof schema.cheatPairs.$inferInsert, 'runId'>[] = []
  let comparisons = 0
  for (const name of Object.keys(files)) {
    if (!name.startsWith('comparisons/') || !name.endsWith('.json'))
      continue
    comparisons++
    const c = JSON.parse(text(name)) as JplagComparison
    let a = byId.get(c.firstSubmissionId)
    let b = byId.get(c.secondSubmissionId)
    if (!a || !b || (a.old && b.old) || c.similarities.AVG < STORE_MIN_SIMILARITY)
      continue
    // A student's own older work is not copying.
    if (a.row.username === b.row.username)
      continue
    if (c.similarities.LONGEST_MATCH < FRAGMENT_LONGEST_MATCH && c.similarities.AVG < FRAGMENT_MAX_SIMILARITY)
      continue
    // Submission A is always from the checked assignment.
    const swap = a.old
    if (swap)
      [a, b] = [b, a]
    const matches = c.matches.map(m => swap
      ? [m.startInSecond.line, m.endInSecond.line, m.startInFirst.line, m.endInFirst.line, m.lengthOfFirst]
      : [m.startInFirst.line, m.endInFirst.line, m.startInSecond.line, m.endInSecond.line, m.lengthOfFirst])
    pairs.push({
      userA: a.row.username,
      submitA: a.row.submitId,
      userB: b.row.username,
      submitB: b.row.submitId,
      assignmentB: b.row.assignment,
      problemB: b.row.problem,
      similarity: c.similarities.AVG,
      maxSimilarity: c.similarities.MAX,
      longestMatch: Math.round(c.similarities.LONGEST_MATCH),
      matches: JSON.stringify(matches),
    })
  }
  return { pairs, failed, comparisons }
}

/** Keeps only the newest finished run per (assignment, problem, language). */
async function pruneOlderRuns(run: CheatRun) {
  const db = useDb()
  const old = await db.select({ id: cheatRuns.id }).from(cheatRuns).where(and(
    eq(cheatRuns.assignment, run.assignment),
    eq(cheatRuns.problem, run.problem),
    eq(cheatRuns.language, run.language),
    ne(cheatRuns.id, run.id),
    inArray(cheatRuns.status, ['done', 'failed']),
  ))
  if (!old.length)
    return
  const ids = old.map(r => r.id)
  await db.delete(cheatPairs).where(inArray(cheatPairs.runId, ids))
  await db.delete(cheatRuns).where(inArray(cheatRuns.id, ids))
  for (const id of ids)
    await rm(await cheatReportPath(id), { force: true })
}

// ---------------------------------------------------------------------------
// Reading results

async function refs() {
  const names = await getNames()
  const assignmentNames = new Map((await useDb().select({ id: assignments.id, name: assignments.name }).from(assignments)).map(a => [a.id, a.name]))
  return (username: string, submitId: number, assignment: number, problem: number, old: boolean): CheatSubmissionRef => ({
    username,
    displayName: names[username] ?? '',
    submitId,
    assignment,
    assignmentName: assignmentNames.get(assignment) ?? `Assignment ${assignment}`,
    problem,
    old,
  })
}

/** Stored pairs of the latest runs of an assignment, most similar first. */
export async function cheatPairsList(assignmentId: number, filter: { problem?: number, minSimilarity?: number, limit?: number } = {}): Promise<CheatPair[]> {
  const runs = (await cheatLatestRuns(assignmentId)).filter(r => r.status === 'done' && (!filter.problem || r.problem === filter.problem))
  if (!runs.length)
    return []
  const runById = new Map(runs.map(r => [r.id, r]))
  const rows = await useDb().select({
    id: cheatPairs.id,
    runId: cheatPairs.runId,
    userA: cheatPairs.userA,
    submitA: cheatPairs.submitA,
    userB: cheatPairs.userB,
    submitB: cheatPairs.submitB,
    assignmentB: cheatPairs.assignmentB,
    problemB: cheatPairs.problemB,
    similarity: cheatPairs.similarity,
    maxSimilarity: cheatPairs.maxSimilarity,
    longestMatch: cheatPairs.longestMatch,
  }).from(cheatPairs).where(inArray(cheatPairs.runId, [...runById.keys()])).orderBy(desc(cheatPairs.similarity)).limit(filter.limit ?? 2000)
  const ref = await refs()
  return rows
    .filter(r => r.similarity >= (filter.minSimilarity ?? 0))
    .map((r) => {
      const run = runById.get(r.runId)!
      return {
        id: r.id,
        runId: r.runId,
        problem: run.problem,
        language: run.language,
        a: ref(r.userA, r.submitA, assignmentId, run.problem, false),
        b: ref(r.userB, r.submitB, r.assignmentB, r.problemB, r.assignmentB !== assignmentId),
        similarity: r.similarity,
        maxSimilarity: r.maxSimilarity,
        longestMatch: r.longestMatch,
      }
    })
}

export async function cheatPairDetail(pairId: number): Promise<CheatPairDetail | null> {
  const [row] = await useDb().select().from(cheatPairs).where(eq(cheatPairs.id, pairId))
  if (!row)
    return null
  const [runRow] = await useDb().select().from(cheatRuns).where(eq(cheatRuns.id, row.runId))
  if (!runRow)
    return null
  const run = toRun(runRow)
  const ref = await refs()
  const code = async (username: string, assignment: number, problem: number, submitId: number) => {
    const s = await submissionFind(username, assignment, problem, submitId)
    return s ? readFile(await submissionCodePath(s), 'utf8').catch(() => '') : ''
  }
  const matches: CheatMatch[] = (JSON.parse(row.matches) as number[][]).map(([aStart, aEnd, bStart, bEnd, tokens]) => ({
    aStart: aStart!, aEnd: aEnd!, bStart: bStart!, bEnd: bEnd!, tokens: tokens!,
  }))
  return {
    id: row.id,
    runId: row.runId,
    problem: run.problem,
    problemName: (await problemInfo(run.assignment, run.problem))?.name ?? `Problem ${run.problem}`,
    language: run.language,
    a: ref(row.userA, row.submitA, run.assignment, run.problem, false),
    b: ref(row.userB, row.submitB, row.assignmentB, row.problemB, row.assignmentB !== run.assignment),
    similarity: row.similarity,
    maxSimilarity: row.maxSimilarity,
    longestMatch: row.longestMatch,
    codeA: await code(row.userA, run.assignment, run.problem, row.submitA),
    codeB: await code(row.userB, row.assignmentB, row.problemB, row.submitB),
    matches,
  }
}

/** Assignment a pair belongs to (for permission checks and navigation). */
export async function cheatPairAssignment(pairId: number): Promise<number | null> {
  const [row] = await useDb().select({ assignment: cheatRuns.assignment }).from(cheatPairs)
    .innerJoin(cheatRuns, eq(cheatRuns.id, cheatPairs.runId)).where(eq(cheatPairs.id, pairId))
  return row?.assignment ?? null
}

// ---------------------------------------------------------------------------
// Suspicion signals

/**
 * One row per final code submission, combining code similarity with what the editor
 * recorded while it was written. The score is a transparent sum of the listed reasons;
 * it points instructors at what to review and is not a verdict.
 */
export async function cheatStudentSignals(assignmentId: number): Promise<CheatStudentSignal[]> {
  const finals = await finalCodeSubmissions([assignmentId])
  const problems = await assignmentProblems(assignmentId)
  const names = await getNames()
  const pairs = await cheatPairsList(assignmentId, { limit: 100000 })
  const recs = await useDb().select().from(recording).where(eq(recording.assignment, assignmentId))
  const recByKey = new Map(recs.map(r => [`${r.username}/${r.problem}/${r.recId}`, r]))
  const analysed = new Set((await cheatLatestRuns(assignmentId)).filter(r => r.status === 'done').map(r => `${r.problem}/${r.language}`))

  const out: CheatStudentSignal[] = []
  for (const s of finals) {
    const language = fileTypeToCheatLanguage(s.fileType)!
    let best: { sim: number, username: string, pairId: number, old: boolean } | null = null
    for (const p of pairs) {
      if (p.problem !== s.problem)
        continue
      const mine = p.a.username === s.username && p.a.submitId === s.submitId
      const theirs = !p.b.old && p.b.username === s.username && p.b.submitId === s.submitId && p.b.problem === s.problem
      if (!mine && !theirs)
        continue
      const other = mine ? p.b : p.a
      if (!best || p.similarity > best.sim)
        best = { sim: p.similarity, username: other.username, pairId: p.id, old: other.old }
    }
    const code = await readFile(await submissionCodePath(s), 'utf8').catch(() => '')
    const rec = recByKey.get(`${s.username}/${s.problem}/${s.submitId}`)
    const similarity = analysed.has(`${s.problem}/${language}`) ? (best?.sim ?? 0) : null

    const reasons: string[] = []
    let score = 0
    if (similarity !== null && best) {
      const pct = Math.round(similarity * 100)
      const who = best.old ? `${best.username} (older submission)` : best.username
      if (similarity >= 0.9) {
        score += 55
        reasons.push(`Code is ${pct}% similar to ${who}`)
      }
      else if (similarity >= 0.7) {
        score += 40
        reasons.push(`Code is ${pct}% similar to ${who}`)
      }
      else if (similarity >= 0.5) {
        score += 20
        reasons.push(`Code is ${pct}% similar to ${who}`)
      }
    }
    if (rec && code.length > 0) {
      const ratio = rec.maxInserted / code.length
      if (rec.maxInserted >= 200 && ratio >= 0.5) {
        score += 30
        reasons.push(`Pasted ${rec.maxInserted} characters at once (${Math.round(ratio * 100)}% of the final code)`)
      }
      else if (rec.maxInserted >= 100) {
        score += 15
        reasons.push(`Pasted ${rec.maxInserted} characters at once`)
      }
      if (rec.totalNavOut >= 15) {
        score += 15
        reasons.push(`Left the page ${rec.totalNavOut} times while coding`)
      }
      else if (rec.totalNavOut >= 8) {
        score += 8
        reasons.push(`Left the page ${rec.totalNavOut} times while coding`)
      }
      if (rec.duration > 0 && rec.duration < 120000 && code.length >= 400) {
        score += 10
        reasons.push(`Wrote ${code.length} characters in under 2 minutes of editor time`)
      }
    }
    score = Math.min(100, score)
    out.push({
      username: s.username,
      displayName: names[s.username] ?? '',
      problem: s.problem,
      problemName: problems[s.problem]?.name ?? `Problem ${s.problem}`,
      submitId: s.submitId,
      similarity,
      closest: best ? { username: best.username, pairId: best.pairId, old: best.old } : null,
      largestPaste: rec ? rec.maxInserted : null,
      codeLength: code.length,
      tabSwitches: rec ? rec.totalNavOut : null,
      duration: rec ? rec.duration : null,
      score,
      level: score >= 55 ? 'high' : score >= 25 ? 'medium' : 'low',
      reasons,
    })
  }
  return out.sort((a, b) => b.score - a.score || (b.similarity ?? 0) - (a.similarity ?? 0) || a.username.localeCompare(b.username))
}

/** Size of the stored JPlag report, or null when there is none. */
export async function cheatReportSize(runId: number): Promise<number | null> {
  return stat(await cheatReportPath(runId)).then(s => s.size, () => null)
}

/** Saves or removes the template code of a problem for one language. */
export async function cheatSaveBaseCode(assignmentId: number, problemId: number, language: CheatLanguage, content: string) {
  const path = await cheatBaseCodePath(assignmentId, problemId, language)
  if (!content.trim()) {
    await rm(path, { force: true })
    return
  }
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
}

/** Used to report which other assignments can be compared against. */
export async function cheatOtherAssignments(assignmentId: number) {
  return useDb().select({ id: assignments.id, name: assignments.name, archived: assignments.archivedAssignment })
    .from(assignments).where(ne(assignments.id, assignmentId)).orderBy(desc(assignments.id))
}


// ---------------------------------------------------------------------------
// History across assignments

/**
 * Similar pairs from the latest analysis of every assignment, grouped by student and by
 * pair of students. Pairs that show up in several assignments are the strongest signal.
 */
export async function cheatHistory(minSimilarity: number): Promise<import('#shared/cheat').CheatHistory> {
  const rows = await useDb().select({
    pairId: cheatPairs.id,
    assignment: cheatRuns.assignment,
    userA: cheatPairs.userA,
    userB: cheatPairs.userB,
    similarity: cheatPairs.similarity,
  }).from(cheatPairs)
    .innerJoin(cheatRuns, eq(cheatRuns.id, cheatPairs.runId))
    .where(and(eq(cheatRuns.status, 'done')))
  const names = await getNames()
  const assignmentNames = new Map((await useDb().select({ id: assignments.id, name: assignments.name }).from(assignments)).map(a => [a.id, a.name]))
  const analysed = new Set((await useDb().select({ assignment: cheatRuns.assignment }).from(cheatRuns).where(eq(cheatRuns.status, 'done'))).map(r => r.assignment))

  type Hit = { assignment: number, similarity: number, pairId: number }
  const byPair = new Map<string, Map<number, Hit>>()
  const byStudent = new Map<string, { pairs: number, hits: Map<number, Hit & { partner: string }>, partners: Map<string, Set<number>> }>()

  for (const r of rows) {
    if (r.similarity < minSimilarity || r.userA === r.userB)
      continue
    const [a, b] = [r.userA, r.userB].sort() as [string, string]
    const key = `${a}\u0000${b}`
    const perAssignment = byPair.get(key) ?? new Map<number, Hit>()
    const prev = perAssignment.get(r.assignment)
    if (!prev || r.similarity > prev.similarity)
      perAssignment.set(r.assignment, { assignment: r.assignment, similarity: r.similarity, pairId: r.pairId })
    byPair.set(key, perAssignment)

    for (const [me, other] of [[r.userA, r.userB], [r.userB, r.userA]] as const) {
      const s = byStudent.get(me) ?? { pairs: 0, hits: new Map(), partners: new Map() }
      s.pairs++
      const hit = s.hits.get(r.assignment)
      if (!hit || r.similarity > hit.similarity)
        s.hits.set(r.assignment, { assignment: r.assignment, similarity: r.similarity, pairId: r.pairId, partner: other })
      s.partners.set(other, (s.partners.get(other) ?? new Set()).add(r.assignment))
      byStudent.set(me, s)
    }
  }

  const toAssignment = (h: Hit) => ({ id: h.assignment, name: assignmentNames.get(h.assignment) ?? `Assignment ${h.assignment}`, similarity: h.similarity, pairId: h.pairId })
  const repeatPairs = [...byPair.entries()]
    .filter(([, hits]) => hits.size >= 2)
    .map(([key, hits]) => {
      const [a, b] = key.split('\u0000') as [string, string]
      const list = [...hits.values()].sort((x, y) => x.assignment - y.assignment)
      return {
        a: { username: a, displayName: names[a] ?? '' },
        b: { username: b, displayName: names[b] ?? '' },
        count: hits.size,
        maxSimilarity: Math.max(...list.map(h => h.similarity)),
        assignments: list.map(toAssignment),
      }
    })
    .sort((x, y) => y.count - x.count || y.maxSimilarity - x.maxSimilarity)

  const students = [...byStudent.entries()]
    .map(([username, s]) => {
      const hits = [...s.hits.values()].sort((x, y) => x.assignment - y.assignment)
      return {
        username,
        displayName: names[username] ?? '',
        flaggedAssignments: s.hits.size,
        pairs: s.pairs,
        maxSimilarity: Math.max(...hits.map(h => h.similarity)),
        partners: [...s.partners.entries()].map(([u, set]) => ({ username: u, count: set.size })).sort((x, y) => y.count - x.count),
        assignments: hits.map(h => ({ ...toAssignment(h), partner: h.partner })),
      }
    })
    .sort((x, y) => y.flaggedAssignments - x.flaggedAssignments || y.maxSimilarity - x.maxSimilarity || x.username.localeCompare(y.username))

  return { minSimilarity, analysedAssignments: analysed.size, repeatPairs, students }
}
