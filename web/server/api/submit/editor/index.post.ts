import { and, eq } from 'drizzle-orm'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { languageToType, typeToExtension } from '#shared/languages'

// Editor actions (legacy Submit::save): save the code and recording, and
// optionally submit it for judging or execute it with custom input.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const form = await readForm(event, z.object({
    mode: z.enum(['save', 'submit', 'execute']).default('save'),
    problemId: rules.id,
    language: z.string(),
    code: z.string().max(1024 * 1024),
    input: z.string().max(1024 * 1024).optional().default(''),
    recording: z.string().max(50 * 1024 * 1024).optional().default(''),
    metrics: recMetricsSchema.optional(),
  }))
  const assignment = user.selectedAssignment
  if (!assignment.id || !(await problemInfo(assignment.id, form.problemId)))
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })

  const dir = await submitUserDir(user, form.problemId)
  const metrics = recMetricsSchema.parse(form.metrics ?? {})
  try {
    await writeFile(join(dir, `${EDITOR.file}.${EDITOR.ext}`), form.code)
    await writeFile(join(dir, `${EDITOR.recFile}.${EDITOR.recExt}`), form.recording)
  }
  catch {
    return { status: false, message: 'Unable to save' }
  }
  await recordingSave(0, user.username, assignment.id, form.problemId, metrics)
  if (form.mode === 'save')
    return { status: true, message: 'Saved' }

  let problem, fileType
  try {
    ({ problem, fileType } = await submitCheck(user, form.problemId, form.language))
  }
  catch (e) {
    return { status: false, message: (e as { statusMessage?: string }).statusMessage ?? 'Error' }
  }
  const ext = typeToExtension(fileType)!
  const coefficient = await currentCoefficient(assignment)
  const base = {
    username: user.username,
    assignment: assignment.id,
    problem: problem.id,
    mainFileName: EDITOR.file,
    fileType: languageToType(form.language)!,
    coefficient,
    preScore: 0,
    time: await nowStr(),
  }

  if (form.mode === 'execute') {
    await writeFile(join(dir, `${EDITOR.in}.${EDITOR.ext}`), form.input)
    const fileName = `${EDITOR.file}-${EDITOR.submitId}`
    await writeFile(join(dir, `${fileName}.${ext}`), form.code)
    const [existing] = await useDb().select({ id: schema.submissions.submitId }).from(schema.submissions).where(and(
      eq(schema.submissions.submitId, EDITOR.submitId),
      eq(schema.submissions.username, user.username),
      eq(schema.submissions.assignment, assignment.id),
      eq(schema.submissions.problem, problem.id),
    ))
    if (existing)
      return { status: false, message: 'Still in queue' }
    await writeFile(join(dir, `${EDITOR.out}.${EDITOR.ext}`), 'Queueing...')
    await queueAddSubmission({ ...base, submitId: EDITOR.submitId, fileName }, 'exec')
    queueKick()
    return { status: true, message: 'Executing' }
  }

  // Submit: keep a numbered copy of the code and of the recording.
  const submitId = await submitNextId(assignment.id)
  const fileName = `${EDITOR.file}-${submitId}`
  try {
    await writeFile(join(dir, `${fileName}.${ext}`), form.code)
    await rename(join(dir, `${EDITOR.recFile}.${EDITOR.recExt}`), join(dir, `${EDITOR.recFile}-${submitId}.${EDITOR.recExt}`))
  }
  catch {
    return { status: false, message: 'Unable to submit' }
  }
  await recordingSave(submitId, user.username, assignment.id, problem.id, metrics)
  await recordingRemoveDraft(user.username, assignment.id, problem.id)
  const info = { ...base, submitId, fileName }
  if (problem.isUploadOnly) {
    await submitAddUploadOnly(info)
  }
  else {
    await queueAddSubmission(info)
    queueKick()
  }
  return { status: true, message: 'Submitted' }
})
