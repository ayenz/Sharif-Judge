import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Loads the saved editor code and recording (legacy Submit::load + load_rec).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const problemId = intParam(event, 'problem')
  if (!user.selectedAssignment.id || !(await problemInfo(user.selectedAssignment.id, problemId)))
    throw createError({ statusCode: 404, statusMessage: 'Problem not found' })
  const dir = await submitUserDir(user, problemId)
  await writeFile(join(dir, `${EDITOR.in}.${EDITOR.ext}`), ' ').catch(() => {})
  await writeFile(join(dir, `${EDITOR.out}.${EDITOR.ext}`), ' ').catch(() => {})
  const code = await readFile(join(dir, `${EDITOR.file}.${EDITOR.ext}`), 'utf8').catch(() => null)
  const recording = await readFile(join(dir, `${EDITOR.recFile}.${EDITOR.recExt}`), 'utf8').catch(() => '')
  return {
    content: code ?? '',
    message: code === null ? 'No saved file' : 'Loaded',
    recording,
  }
})
