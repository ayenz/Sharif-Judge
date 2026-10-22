import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { and, asc, eq } from 'drizzle-orm'
import { typeToExtension } from '#shared/languages'

const { queue, submissions } = schema

export type QueueType = 'judge' | 'rejudge' | 'exec'
export type SubmissionRow = typeof schema.submissions.$inferSelect
type SubmissionKey = Pick<SubmissionRow, 'submitId' | 'username' | 'assignment' | 'problem'>

/** Editor and recording files, same names as the legacy constants. */
export const EDITOR = { file: 'editor', ext: 'txt', in: 'exec_in', out: 'exec_out', submitId: 0, recFile: 'record', recExt: 'json' } as const

let running = false

const keyWhere = (k: SubmissionKey) => and(
  eq(submissions.submitId, k.submitId),
  eq(submissions.username, k.username),
  eq(submissions.assignment, k.assignment),
  eq(submissions.problem, k.problem),
)

/** True if the user already has an item waiting for this problem. */
export async function queueHasItem(username: string, assignment: number, problem: number): Promise<boolean> {
  const rows = await useDb().select({ id: queue.id }).from(queue)
    .where(and(eq(queue.username, username), eq(queue.assignment, assignment), eq(queue.problem, problem))).limit(1)
  return rows.length > 0
}

/** Inserts a PENDING submission and queues it for judging. */
export async function queueAddSubmission(info: Omit<SubmissionRow, 'isFinal' | 'status'>, type: QueueType = 'judge') {
  await useDb().transaction(async (tx) => {
    await tx.insert(submissions).values({ ...info, isFinal: 0, status: 'PENDING' })
    await tx.insert(queue).values({
      submitId: info.submitId,
      username: info.username,
      assignment: info.assignment,
      problem: info.problem,
      type,
    })
  })
}

/** Rejudges every submission of a problem (skips upload-only problems). */
export async function queueRejudgeProblem(assignment: number, problem: number) {
  const info = await problemInfo(assignment, problem)
  if (!info || info.isUploadOnly)
    return
  const db = useDb()
  await db.update(submissions).set({ preScore: 0, status: 'PENDING' })
    .where(and(eq(submissions.assignment, assignment), eq(submissions.problem, problem)))
  const rows = await db.select().from(submissions)
    .where(and(eq(submissions.assignment, assignment), eq(submissions.problem, problem)))
    .orderBy(asc(submissions.submitId))
  for (const s of rows) {
    await db.insert(queue).values({ submitId: s.submitId, username: s.username, assignment, problem, type: 'rejudge' })
      .onDuplicateKeyUpdate({ set: { type: 'rejudge' } })
  }
}

export async function queueRejudgeOne(key: SubmissionKey) {
  const info = await problemInfo(key.assignment, key.problem)
  if (!info || info.isUploadOnly)
    return
  await useDb().update(submissions).set({ preScore: 0, status: 'PENDING' }).where(keyWhere(key))
  await useDb().insert(queue).values({ ...key, type: 'rejudge' }).onDuplicateKeyUpdate({ set: { type: 'rejudge' } })
}

export async function queueEmpty() {
  await useDb().delete(queue)
}

/**
 * Starts processing the queue in the background unless it is already running.
 * Replaces the legacy `php index.php queueprocess run &`.
 */
export function queueKick() {
  if (running || !useRuntimeConfig().queue.enabled)
    return
  running = true
  processQueue()
    .catch(error => console.error('[queue] worker stopped:', error))
    .finally(() => (running = false))
}

export function queueIsRunning() {
  return running
}

async function firstItem() {
  const [item] = await useDb().select().from(queue).orderBy(asc(queue.id)).limit(1)
  return item
}

async function processQueue() {
  let item = await firstItem()
  if (!item) {
    await setSetting('queue_is_working', '0')
    return
  }
  await setSetting('queue_is_working', '1')
  // Pausing sets queue_is_working to 0; the current item still finishes.
  while (item && (await getSetting('queue_is_working')) === '1') {
    try {
      await judgeItem(item)
    }
    catch (error) {
      console.error(`[queue] judging submission ${item.submitId} of ${item.username} failed:`, error)
      await useDb().update(submissions).set({ status: 'Judge Error', preScore: 0 }).where(keyWhere(item))
      await removeItem(item)
    }
    item = await firstItem()
  }
  await setSetting('queue_is_working', '0')
}

async function removeItem(item: typeof schema.queue.$inferSelect) {
  await useDb().delete(queue).where(and(
    eq(queue.submitId, item.submitId),
    eq(queue.username, item.username),
    eq(queue.assignment, item.assignment),
    eq(queue.problem, item.problem),
  ))
  // The editor's "execute" creates a temporary submission with id 0.
  if (item.submitId === EDITOR.submitId)
    await useDb().delete(submissions).where(keyWhere(item))
}

async function judgeItem(item: typeof schema.queue.$inferSelect) {
  const type = item.type as QueueType
  const assignment = await getAssignment(item.assignment)
  const problem = await problemInfo(item.assignment, item.problem)
  const [submission] = await useDb().select().from(submissions).where(keyWhere(item))
  if (!problem || !submission) {
    await removeItem(item)
    return
  }

  const settings = await getAllSettings()
  const fileType = submission.fileType
  const ext = typeToExtension(fileType)
  const pDir = await problemDir(item.assignment, problem.id)
  const uDir = await userDir(item.assignment, problem.id, item.username)
  const tester = await testerPath()

  let timeLimitMs = problem.cTimeLimit
  if (fileType === 'java')
    timeLimitMs = problem.javaTimeLimit
  else if (ext === 'py')
    timeLimitMs = problem.pythonTimeLimit
  const timeLimit = Math.round(timeLimitMs / 1000 * 1000) / 1000
  const shield = fileType === 'c'
    ? settings.enable_c_shield
    : fileType === 'cpp' ? settings.enable_cpp_shield : '0'
  const pyShield = fileType === 'py2'
    ? settings.enable_py2_shield
    : fileType === 'py3' ? settings.enable_py3_shield : '0'

  // Same positional arguments as the legacy Queueprocess controller.
  const args = [
    pDir,
    item.username,
    submission.mainFileName,
    submission.fileName,
    fileType,
    String(timeLimit),
    String(Math.floor(timeLimit) + 1),
    String(problem.memoryLimit),
    String(Number(settings.output_size_limit) * 1024),
    problem.diffCmd,
    // The legacy command line was not quoted, so a multi-word diff argument split.
    ...problem.diffArg.split(/\s+/).filter(Boolean),
    settings.enable_log,
    settings.enable_easysandbox,
    shield,
    pyShield,
    settings.enable_java_policy,
    String(assignment.javaexceptions),
    type === 'exec' ? '1' : '0',
  ]
  await writeFile(join(uDir, 'log'), `cd ${tester};\n./tester.sh ${args.join(' ')}`)

  const output = (await runTester(tester, args)).trim()

  // Remove leftover jail directories.
  for (const name of await readdir(tester).catch(() => [] as string[])) {
    if (name.startsWith('jail'))
      await rm(join(tester, name), { recursive: true, force: true })
  }

  const isScore = /^\d+$/.test(output)
  if (isScore || output === 'Compilation Error' || output === 'Syntax Error') {
    await rename(join(uDir, 'result.html'), join(uDir, `result-${item.submitId}.html`)).catch(() => {})
    await rename(join(uDir, 'log'), join(uDir, `log-${item.submitId}`)).catch(() => {})
  }

  const status = isScore ? 'SCORE' : (output || 'Judge Error').slice(0, 100)
  const preScore = isScore ? Number(output) : 0
  const db = useDb()
  if (type === 'judge') {
    await db.update(submissions).set({ isFinal: 0 }).where(and(
      eq(submissions.isFinal, 1),
      eq(submissions.username, item.username),
      eq(submissions.assignment, item.assignment),
      eq(submissions.problem, item.problem),
    ))
    await db.update(submissions).set({ status, preScore, isFinal: 1 }).where(keyWhere(item))
  }
  else {
    await db.update(submissions).set({ status, preScore }).where(keyWhere(item))
  }
  await removeItem(item)
}

function runTester(cwd: string, args: string[]): Promise<string> {
  return useRuntimeConfig().judge.mode === 'remote' ? runRemote(args) : runLocal(cwd, args)
}

function runLocal(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('bash', ['./tester.sh', ...args], {
      cwd,
      // Submitted programs inherit this environment: pass only what the tools need,
      // never the server's secrets (database password, session key, ...).
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', LANG: 'en_US.UTF-8', HOME: '/tmp' },
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
    child.on('error', () => resolve('Judge Error'))
    child.on('close', () => resolve(out))
  })
}

const REMOTE_TIMEOUT_MS = 30 * 60 * 1000

/** Hands the job to the judge container (judge/worker.mjs) and waits for its result file. */
async function runRemote(args: string[]): Promise<string> {
  const dir = useRuntimeConfig().judge.jobsDir
  await mkdir(dir, { recursive: true, mode: 0o700 })
  // Time-ordered names: the judge processes jobs in name order.
  const id = `${Date.now().toString().padStart(15, '0')}-${randomBytes(4).toString('hex')}`
  const jobFile = join(dir, `${id}.job.json`)
  await writeFile(`${jobFile}.tmp`, JSON.stringify({ args }))
  await rename(`${jobFile}.tmp`, jobFile)
  const resultFile = join(dir, `${id}.result.json`)
  const deadline = Date.now() + REMOTE_TIMEOUT_MS
  while (Date.now() < deadline) {
    const text = await readFile(resultFile, 'utf8').catch(() => null)
    if (text !== null) {
      await rm(resultFile, { force: true })
      try {
        return String(JSON.parse(text).output ?? '')
      }
      catch {
        return 'Judge Error'
      }
    }
    await new Promise(r => setTimeout(r, 250))
  }
  await rm(jobFile, { force: true })
  console.error(`[queue] the judge did not answer job ${id} in time`)
  return 'Judge Error'
}
