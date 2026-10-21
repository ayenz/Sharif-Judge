// File-system side of assignments and problems: PDFs, test archives, descriptions.
// Mirrors the legacy Assignments controller / Assignment_model, without shell commands.
import type { H3Event } from 'h3'
import { cp, mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { max } from 'drizzle-orm'
import { z } from 'zod'

export interface AssignmentMessage {
  type: 'success' | 'notice' | 'error'
  text: string
}

/** Extensions extracted from a tests/descriptions zip (legacy Unzip allow list). */
export const ASSIGNMENT_ZIP_EXTENSIONS = ['txt', 'cpp', 'html', 'md', 'pdf']

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

async function isDir(path: string): Promise<boolean> {
  return stat(path).then(s => s.isDirectory(), () => false)
}

async function listDir(path: string): Promise<string[]> {
  return readdir(path).then(names => names.sort(), () => [])
}

/** Like PHP glob("dir/*.pdf"): sorted, case-sensitive ".pdf". */
async function pdfFilesIn(dir: string): Promise<string[]> {
  return (await listDir(dir)).filter(n => n.endsWith('.pdf')).map(n => join(dir, n))
}

/** First PDF of an assignment (problemId omitted) or of one of its problems, or null. */
export async function assignmentPdfPath(assignmentId: number, problemId?: number | null): Promise<string | null> {
  const dir = problemId ? await problemDir(assignmentId, problemId) : await assignmentDir(assignmentId)
  return (await pdfFilesIn(dir))[0] ?? null
}

/**
 * Why a user may not open an assignment/problem PDF right now, or null.
 * Same checks and messages as the legacy pdf()/pdfCheck(). Instructors (level >= 1)
 * are always allowed: the legacy app applied these checks to everybody, which
 * locked staff out of PDFs of closed or finished assignments.
 */
export async function assignmentPdfBlockedReason(assignment: Assignment, user: { username: string, level: number }): Promise<string | null> {
  if (!assignment.id)
    return 'File not found'
  if (user.level >= 1)
    return null
  const now = await nowEpoch()
  if (!assignment.open)
    return 'Selected assignment has been closed.'
  if (!isParticipant(assignment.participants, user.username))
    return 'You are not registered for submitting.'
  if (now > toEpoch(assignment.finishTime) + assignment.extraTime)
    return 'Selected assignment has finished.'
  if (now < toEpoch(assignment.startTime))
    return 'Selected assignment has not started.'
  return null
}

/** Smallest id after max(id) whose folder does not exist yet (legacy new_assignment_id). */
export async function assignmentNewId(): Promise<number> {
  const [row] = await useDb().select({ max: max(schema.assignments.id) }).from(schema.assignments)
  let id = Number(row?.max ?? 0) + 1
  const root = await assignmentsRoot()
  while (await exists(join(root, `assignment_${id}`)))
    id++
  return id
}

/** Seconds -> text for the form, like the legacy extra_time_formatter filter. */
export function extraTimeFormat(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return minutes % 60 === 0 ? `${minutes / 60}*60` : String(minutes)
}

/** "48*60" (minutes, product of numbers) -> seconds, or null when malformed. */
export function extraTimeParse(text: string): number | null {
  const parts = text.split('*').map(p => p.trim())
  if (!parts.length || parts.some(p => !/^\d+(?:\.\d+)?$/.test(p)))
    return null
  const minutes = parts.reduce((acc, p) => acc * Number(p), 1)
  const seconds = Math.round(minutes * 60)
  return Number.isSafeInteger(seconds) && seconds <= 2147483647 ? seconds : null
}

/** Replaces the assignment PDF (old root PDFs are removed). Returns the stored name. */
export async function assignmentSavePdf(assignmentId: number, originalName: string, data: Uint8Array): Promise<string> {
  const dir = await assignmentDir(assignmentId)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  // Sanitize like CodeIgniter's upload library (spaces -> underscores, no path parts).
  const base = originalName.split(/[\\/]/).pop() ?? 'assignment.pdf'
  const name = base.replace(/\s+/g, '_').replace(/[^\w\-().]/g, '')
  const safe = /\.pdf$/i.test(name) && name.length > 4 ? name.replace(/\.pdf$/i, '.pdf') : 'assignment.pdf'
  for (const old of await pdfFilesIn(dir))
    await unlink(old).catch(() => {})
  await writeFile(join(dir, safe), data, { mode: 0o600 })
  return safe
}

/**
 * Extracts a tests/descriptions zip into the assignment folder with the legacy
 * semantics: extract to a temp dir, then remove old in/, out/, tester.cpp,
 * tester.executable, desc.*, problem PDFs (and root PDFs if the zip has one), then copy.
 */
export async function assignmentInstallTests(assignmentId: number, zip: Uint8Array, messages: AssignmentMessage[]): Promise<boolean> {
  const root = await assignmentsRoot()
  const dir = await assignmentDir(assignmentId)
  const tmp = join(root, `shj_tmp_${randomBytes(6).toString('hex')}`)
  await mkdir(tmp, { recursive: true, mode: 0o700 })
  try {
    const result = await zipExtractSafe(zip, tmp, ASSIGNMENT_ZIP_EXTENSIONS)
    if (!result.ok) {
      messages.push({ type: 'error', text: 'Error: Error extracting zip archive.' })
      for (const msg of result.errors)
        messages.push({ type: 'error', text: ` Zip Extraction Error: ${msg}` })
      return false
    }

    await mkdir(dir, { recursive: true, mode: 0o700 })
    for (const sub of await listDir(dir)) {
      const p = join(dir, sub)
      if (!(await isDir(p)))
        continue
      await rm(join(p, 'in'), { recursive: true, force: true })
      await rm(join(p, 'out'), { recursive: true, force: true })
      for (const f of ['tester.cpp', 'tester.executable', 'desc.html', 'desc.md'])
        await rm(join(p, f), { force: true })
      for (const pdf of await pdfFilesIn(p))
        await rm(pdf, { force: true })
    }
    if ((await pdfFilesIn(tmp)).length) {
      for (const pdf of await pdfFilesIn(dir))
        await rm(pdf, { force: true })
    }
    for (const entry of await listDir(tmp)) {
      if (!entry.startsWith('.'))
        await cp(join(tmp, entry), join(dir, entry), { recursive: true, force: true })
    }
    messages.push({ type: 'success', text: 'Tests (zip file) extracted successfully.' })
    return true
  }
  finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

/** Creates missing p<i> folders and regenerates desc.html from desc.md (legacy end of _add). */
export async function assignmentPrepareProblemDirs(assignmentId: number, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const dir = await problemDir(assignmentId, i)
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true, mode: 0o700 })
    }
    else if (await exists(join(dir, 'desc.md'))) {
      const md = await readFile(join(dir, 'desc.md'), 'utf8')
      await writeFile(join(dir, 'desc.html'), markdownRender(md))
    }
  }
}

/** Removes the whole assignment folder (tests and submitted files). */
export async function assignmentRemoveFolder(assignmentId: number): Promise<void> {
  await rm(await assignmentDir(assignmentId), { recursive: true, force: true })
}

async function addDirToZip(files: Record<string, Uint8Array>, abs: string, rel: string): Promise<void> {
  for (const name of await listDir(abs)) {
    const a = join(abs, name)
    const r = `${rel}/${name}`
    if (await isDir(a))
      await addDirToZip(files, a, r)
    else
      files[r] = await readFile(a)
  }
}

/** Files for the "tests and descriptions" download (legacy downloadtestsdesc). */
export async function assignmentTestsZipFiles(assignmentId: number, problemCount: number): Promise<Record<string, Uint8Array>> {
  const root = await assignmentDir(assignmentId)
  const files: Record<string, Uint8Array> = {}
  for (let i = 1; i <= problemCount; i++) {
    const p = join(root, `p${i}`)
    await addDirToZip(files, join(p, 'in'), `p${i}/in`)
    await addDirToZip(files, join(p, 'out'), `p${i}/out`)
    for (const f of ['tester.cpp']) {
      if (await exists(join(p, f)))
        files[`p${i}/${f}`] = await readFile(join(p, f))
    }
    const [pdf] = await pdfFilesIn(p)
    if (pdf)
      files[`p${i}/${pdf.split('/').pop()}`] = await readFile(pdf)
    for (const f of ['desc.html', 'desc.md']) {
      if (await exists(join(p, f)))
        files[`p${i}/${f}`] = await readFile(join(p, f))
    }
  }
  const [pdf] = await pdfFilesIn(root)
  if (pdf)
    files[pdf.split('/').pop()!] = await readFile(pdf)
  return files
}

/** Contents of p<i>/desc.<ext>, or null when missing. */
export async function problemReadDescription(assignmentId: number, problemId: number, ext: 'html' | 'md'): Promise<string | null> {
  return readFile(join(await problemDir(assignmentId, problemId), `desc.${ext}`), 'utf8').catch(() => null)
}

/** Legacy save_problem_description: html removes desc.md; md saves desc.md and renders desc.html. */
export async function problemSaveDescription(assignmentId: number, problemId: number, text: string, type: 'html' | 'md'): Promise<void> {
  const dir = await problemDir(assignmentId, problemId)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  if (type === 'html') {
    await rm(join(dir, 'desc.md'), { force: true })
    await writeFile(join(dir, 'desc.html'), text)
  }
  else {
    await writeFile(join(dir, 'desc.md'), text)
    await writeFile(join(dir, 'desc.html'), markdownRender(text))
  }
}

/** "Y-m-d_H-i" stamp for download file names. */
export function assignmentFileStamp(now: string): string {
  return now.slice(0, 16).replace(' ', '_').replace(':', '-')
}

// ---------------------------------------------------------------------------
// Add / edit request handling (legacy Assignments::_add)

const DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/

function wallClock(label: string) {
  return z.string({ error: `The ${label} field is required.` }).trim()
    .min(1, `The ${label} field is required.`)
    .refine(v => DATETIME.test(v) && !Number.isNaN(Date.parse(`${v.replace(' ', 'T').slice(0, 16)}Z`)), `The ${label} field must be a valid date and time.`)
    .transform((v) => {
      const m = DATETIME.exec(v)!
      return `${m[1]} ${m[2]}${m[3] ?? ':00'}`
    })
}

function integer(label: string, min?: number) {
  return z.unknown().transform((v, ctx) => {
    const fail = (message: string) => {
      ctx.addIssue({ code: 'custom', message })
      return z.NEVER
    }
    if (v === '' || v === null || v === undefined)
      return fail(`The ${label} field is required.`)
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*-?\d+\s*$/.test(v) ? Number(v) : Number.NaN
    if (!Number.isInteger(n))
      return fail(`The ${label} field must contain an integer.`)
    if (min !== undefined && n < min)
      return fail(`The ${label} field must be at least ${min}.`)
    if (Math.abs(n) > 2147483647)
      return fail(`The ${label} field is too large.`)
    return n
  })
}

function required(label: string, maxLength: number) {
  return z.string({ error: `The ${label} field is required.` })
    .refine(v => v.trim() !== '', `The ${label} field is required.`)
    .refine(v => v.length <= maxLength, `The ${label} field cannot exceed ${maxLength} characters in length.`)
}

const problemSchema = z.object({
  name: required('problem name', 50),
  score: integer('problem score'),
  cTimeLimit: integer('C/C++ time limit', 0),
  pythonTimeLimit: integer('python time limit', 0),
  javaTimeLimit: integer('java time limit', 0),
  memoryLimit: integer('memory limit', 0),
  languages: z.array(z.string()).default([]),
  diffCmd: required('diff command', 20),
  diffArg: required('diff argument', 20),
  isUploadOnly: z.boolean().default(false),
})

const assignmentSchema = z.object({
  name: required('assignment name', 50),
  startTime: wallClock('start time'),
  finishTime: wallClock('finish time'),
  extraTime: z.string({ error: 'The extra time field is required.' }).trim().min(1, 'The extra time field is required.'),
  participants: z.string().default(''),
  lateRule: z.string({ error: 'The coefficient rule field is required.' }).refine(v => v.trim() !== '', 'The coefficient rule field is required.'),
  open: z.boolean().default(false),
  scoreboard: z.boolean().default(false),
  javaexceptions: z.boolean().default(false),
  archived: z.boolean().default(false),
  problems: z.array(problemSchema).min(1, 'Add at least one problem.').max(200, 'Too many problems.'),
})

export type AssignmentFormBody = z.input<typeof assignmentSchema>

/**
 * Handles POST /api/assignments (editId null) and POST /api/assignments/:id.
 * Multipart body: `data` (JSON of the form), optional `tests_desc` (zip) and `pdf`.
 */
export async function assignmentSaveFromRequest(event: H3Event, editId: number | null) {
  const parts = await readMultipartFormData(event) ?? []
  const part = (name: string) => parts.find(p => p.name === name)
  let raw: unknown = {}
  try {
    raw = JSON.parse(part('data')?.data.toString('utf8') ?? '{}')
  }
  catch {
    throw validationError({ _: 'Invalid form data.' })
  }

  const parsed = assignmentSchema.safeParse(raw)
  const errors: Record<string, string> = {}
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      errors[key] ??= issue.message
    }
  }
  const form = parsed.data
  let extraTime: number | null = null
  if (form) {
    extraTime = extraTimeParse(form.extraTime)
    if (extraTime === null)
      errors.extraTime = 'Extra time must be a number of minutes, or a product such as 48*60.'
    // Rules are PHP snippets translated to JavaScript; refuse rules that do not compile so
    // coefficients are never recomputed with a broken rule.
    const ruleError = assignmentLateRuleError(form.lateRule)
    if (ruleError)
      errors.lateRule = `The coefficient rule has a syntax error: ${ruleError}`
    form.problems.forEach((p, i) => {
      if (!assignmentNormalizeLanguages(p.languages, p.isUploadOnly))
        errors[`problems.${i}.languages`] = p.isUploadOnly ? 'Select at least one language.' : 'Select at least one judged language (C, C++, Python, Java).'
    })
  }
  if (!form || Object.keys(errors).length)
    throw validationError(errors)

  if (editId !== null && !(await getAssignment(editId)).id)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const edit = editId !== null
  const id = editId ?? await assignmentNewId()
  const messages: AssignmentMessage[] = []

  try {
    await assignmentSave(id, {
      name: form.name,
      startTime: form.startTime,
      finishTime: form.finishTime,
      extraTime: extraTime!,
      participants: form.participants,
      lateRule: form.lateRule,
      open: form.open,
      scoreboard: form.scoreboard,
      javaexceptions: form.javaexceptions,
      archived: form.archived,
      problems: form.problems.map(p => ({
        ...p,
        allowedLanguages: assignmentNormalizeLanguages(p.languages, p.isUploadOnly),
      })),
    }, edit)
  }
  catch (e) {
    console.error('[assignments] save failed', e)
    throw createError({ statusCode: 500, statusMessage: `Error ${edit ? 'updating' : 'adding'} assignment.` })
  }
  messages.push({ type: 'success', text: `Assignment ${edit ? 'updated' : 'added'} successfully.` })

  const dir = await assignmentDir(id)
  await mkdir(dir, { recursive: true, mode: 0o700 })

  // Tests and descriptions (zip)
  const zip = part('tests_desc')
  let zipData: Uint8Array | null = null
  if (!zip?.filename || !zip.data.length) {
    messages.push({ type: 'notice', text: 'Notice: You did not upload any zip file for tests. If needed, upload by editing assignment.' })
  }
  else if (!/\.zip$/i.test(zip.filename) || zip.data[0] !== 0x50 || zip.data[1] !== 0x4B) {
    messages.push({ type: 'error', text: 'Error: Error uploading tests zip file: The filetype you are attempting to upload is not allowed.' })
  }
  else {
    zipData = zip.data
    messages.push({ type: 'success', text: 'Tests (zip file) uploaded successfully.' })
  }

  // Assignment PDF
  const pdf = part('pdf')
  if (!pdf?.filename || !pdf.data.length) {
    messages.push({ type: 'notice', text: 'Notice: You did not upload any pdf file for assignment. If needed, upload by editing assignment.' })
  }
  else if (!/\.pdf$/i.test(pdf.filename) || pdf.data.subarray(0, 4).toString('latin1') !== '%PDF') {
    messages.push({ type: 'error', text: 'Error: Error uploading pdf file of assignment: The filetype you are attempting to upload is not allowed.' })
  }
  else {
    try {
      await assignmentSavePdf(id, pdf.filename, pdf.data)
      messages.push({ type: 'success', text: 'PDF file uploaded successfully.' })
    }
    catch (e) {
      messages.push({ type: 'error', text: `Error: Error uploading pdf file of assignment: ${(e as Error).message}` })
    }
  }

  // Extract tests after the PDF, like the legacy order (a root PDF in the zip wins).
  if (zipData)
    await assignmentInstallTests(id, zipData, messages)

  await assignmentPrepareProblemDirs(id, form.problems.length)

  // Warn (do not block) when the rule does not yield a coefficient right now.
  const coefficient = evalLateRule(form.lateRule, (await nowEpoch()) - toEpoch(form.finishTime), extraTime!)
  if (coefficient === 'error')
    messages.push({ type: 'notice', text: 'Notice: The coefficient rule does not produce a coefficient for the current time (shown as "error").' })

  return { id, messages }
}
