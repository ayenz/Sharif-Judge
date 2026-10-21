import { execFile } from 'node:child_process'
import { access, chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, eq, ne } from 'drizzle-orm'
import { typeToExtension } from '#shared/languages'
import { type CheatLanguage, CHEAT_LANGUAGE_LABEL, fileTypeToCheatLanguage } from '#shared/cheat'

const { submissions, assignments } = schema

// Code files only. The legacy app excluded zip and pdf but still sent txt files to Moss;
// txt submissions are not code, so they are excluded too.
const MOSS_EXCLUDED_TYPES = new Set(['zip', 'pdf', 'txt'])
const MOSS_TIMEOUT_MS = 10 * 60 * 1000

/** Assignments with a detection currently running in this process. */
const running = new Set<number>()

export interface MossProblemLink {
  id: number
  name: string
  /** null: never detected; '': ran but no link (maybe a wrong user id); otherwise the URL. */
  link: string | null
}

export async function mossProblemLinks(assignmentId: number): Promise<MossProblemLink[]> {
  const assignment = await getAssignment(assignmentId)
  const problems = await assignmentProblems(assignmentId)
  const result: MossProblemLink[] = []
  // Like the legacy page: problems 1..assignment.problems.
  for (let i = 1; i <= assignment.problems; i++) {
    const link = await readFile(join(await problemDir(assignmentId, i), 'moss_link.txt'), 'utf8')
      .then(text => text.trim())
      .catch(() => null)
    result.push({ id: i, name: problems[i]?.name ?? `Problem ${i}`, link })
  }
  return result
}

export function mossIsRunning(assignmentId: number): boolean {
  return running.has(assignmentId)
}

/** Writes <tester_path>/moss from moss_original with the user id filled in. */
export async function mossSaveUserId(userId: string): Promise<void> {
  const tester = await testerPath()
  const original = (await readFile(join(tester, 'moss_original'), 'utf8')).trim()
  const target = join(tester, 'moss')
  await writeFile(target, original.replaceAll('MOSS_USER_ID', userId))
  await chmod(target, 0o755)
  await setSetting('moss_userid', userId)
}

/** Moss language names (`-l`); the legacy app never passed one, so everything was parsed as C. */
const MOSS_LANGUAGE: Record<CheatLanguage, string> = { c: 'c', cpp: 'cc', java: 'java', python3: 'python' }

function runMoss(script: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    // No shell: file names are passed as separate arguments (legacy built a shell string).
    execFile(script, args, { cwd, timeout: MOSS_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error)
        console.warn(`[moss] ${script} exited with an error:`, error.message)
      resolve(String(stdout ?? ''))
    })
  })
}

/**
 * Sends the final submissions of every problem to Moss and stores the result link in
 * p<n>/moss_link.txt (the first output line containing "http", like `grep http`).
 */
export async function mossDetect(assignmentId: number): Promise<void> {
  if (running.has(assignmentId))
    throw createError({ statusCode: 409, statusMessage: 'Detection is already running for this assignment.' })
  const tester = await testerPath()
  const script = join(tester, 'moss')
  try {
    await access(script)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Moss script not found. Save your Moss user id first.' })
  }
  running.add(assignmentId)
  try {
    await chmod(script, 0o755).catch(() => {})
    const dir = await assignmentDir(assignmentId)
    const finals = await useDb().select().from(submissions)
      .where(and(
        eq(submissions.assignment, assignmentId),
        eq(submissions.isFinal, 1),
        ne(submissions.submitId, 0), // EDITOR_SUBMIT_ID
      ))
      .orderBy(asc(submissions.username), asc(submissions.problem))

    const groups = new Map<number, typeof finals>()
    for (const s of finals) {
      const list = groups.get(s.problem) ?? []
      list.push(s)
      groups.set(s.problem, list)
    }

    for (const [problemId, group] of groups) {
      // One Moss request per language, so each is parsed with the right grammar.
      const byLanguage = new Map<CheatLanguage, string[]>()
      for (const s of group) {
        const ext = typeToExtension(s.fileType)
        const language = fileTypeToCheatLanguage(s.fileType)
        if (!ext || !language || MOSS_EXCLUDED_TYPES.has(s.fileType))
          continue
        if (!/^[A-Za-z0-9]+$/.test(s.username) || !/^[A-Za-z0-9_\-()]+$/.test(s.fileName))
          continue
        const rel = `p${problemId}/${s.username}/${s.fileName}.${ext}`
        // Skip missing files: the moss script aborts on the first file it cannot read.
        if (await access(join(dir, rel)).then(() => true, () => false))
          byLanguage.set(language, [...(byLanguage.get(language) ?? []), rel])
      }
      const links: string[] = []
      for (const [language, files] of byLanguage) {
        if (files.length < 2)
          continue
        const args = ['-l', MOSS_LANGUAGE[language]]
        const base = await cheatBaseCodePath(assignmentId, problemId, language)
        if (await access(base).then(() => true, () => false))
          args.push('-b', base)
        const output = await runMoss(script, [...args, ...files], dir)
        const link = output.split('\n').find(line => line.includes('http'))?.trim()
        if (link)
          links.push(byLanguage.size > 1 ? `${CHEAT_LANGUAGE_LABEL[language]}: ${link}` : link)
      }
      await writeFile(join(dir, `p${problemId}`, 'moss_link.txt'), links.length ? `${links.join('\n')}\n` : '')
        .catch(error => console.warn('[moss] cannot write moss_link.txt:', (error as Error).message))
    }
    await useDb().update(assignments).set({ mossUpdate: await nowStr() }).where(eq(assignments.id, assignmentId))
  }
  finally {
    running.delete(assignmentId)
  }
}
