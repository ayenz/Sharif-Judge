import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Output of the last "execute" run; status is true once the run finished.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const problemId = intParam(event, 'problem')
  const dir = await userDir(user.selectedAssignment.id, problemId, user.username)
  const content = await readFile(join(dir, `${EDITOR.out}.${EDITOR.ext}`), 'utf8').catch(() => null)
  if (content === null)
    return { status: false, content: '' }
  return { status: content.includes('Total Execution Time'), content }
})
