import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isArchiveType, typeToExtension } from '#shared/languages'

// File upload submit (legacy Submit::_upload).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const parts = await readMultipartFormData(event) ?? []
  const field = (name: string) => parts.find(p => p.name === name && !p.filename)?.data.toString() ?? ''
  const file = parts.find(p => p.name === 'file' && p.filename)

  const problemId = Number(field('problem'))
  if (!Number.isInteger(problemId) || problemId < 1)
    throw validationError({ problem: 'Select a problem.' })
  if (!file || !file.filename)
    throw createError({ statusCode: 400, statusMessage: 'No file chosen.' })

  const { assignment, problem, fileType } = await submitCheck(user, problemId, field('language'))

  const original = file.filename.split(/[\\/]/).pop()!
  const dot = original.lastIndexOf('.')
  const ext = dot >= 0 ? original.slice(dot + 1) : ''
  const base = dot >= 0 ? original.slice(0, dot) : original
  const expectedExt = typeToExtension(fileType)
  if (ext !== expectedExt)
    throw createError({ statusCode: 400, statusMessage: 'This file type does not match your selected language.' })
  if (!/^[\w\-()]+$/.test(base))
    throw createError({ statusCode: 400, statusMessage: 'Invalid characters in file name.' })
  const limitKb = Number(await getSetting('file_size_limit'))
  if (limitKb > 0 && file.data.length > limitKb * 1024)
    throw createError({ statusCode: 413, statusMessage: `The uploaded file exceeds the maximum allowed size (${limitKb} KB).` })
  if (isArchiveType(fileType)) {
    const problemText = javaArchiveCheck(fileType, file.data)
    if (problemText)
      throw createError({ statusCode: 400, statusMessage: problemText })
  }

  const dir = await submitUserDir(user, problem.id)
  const coefficient = await currentCoefficient(assignment)
  const submitId = await submitNextId(assignment.id)
  const fileName = `${base}-${submitId}`
  await writeFile(join(dir, `${fileName}.${ext}`), file.data)

  const info = {
    submitId,
    username: user.username,
    assignment: assignment.id,
    problem: problem.id,
    fileName,
    mainFileName: base,
    fileType,
    coefficient,
    preScore: 0,
    time: await nowStr(),
  }
  if (problem.isUploadOnly) {
    await submitAddUploadOnly(info)
  }
  else {
    await queueAddSubmission(info)
    queueKick()
  }
  return { ok: true, submitId }
})
