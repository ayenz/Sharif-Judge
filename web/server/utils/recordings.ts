import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, desc, eq, type SQL } from 'drizzle-orm'

const { recording, submissions } = schema

// Same as the legacy RECORD_FILE_NAME / RECORD_FILE_EXT constants.
const RECORD_FILE_NAME = 'record'
const RECORD_FILE_EXT = 'json'

export type RecordingRow = typeof schema.recording.$inferSelect

/** Recordings of an assignment, optionally filtered (legacy Recording_model::all_user_recordings). */
export async function recordingsList(assignmentId: number, filter: { problem?: number, username?: string } = {}): Promise<RecordingRow[]> {
  const where: SQL[] = [eq(recording.assignment, assignmentId)]
  if (filter.problem !== undefined)
    where.push(eq(recording.problem, filter.problem))
  if (filter.username !== undefined)
    where.push(eq(recording.username, filter.username))
  return useDb().select().from(recording).where(and(...where)).orderBy(asc(recording.uploadAt))
}

/** Recording file of a user: record.json for the unsaved draft (rec id 0), else record-<id>.json. */
export async function recordingFilePath(assignmentId: number, problemId: number, username: string, recId: number): Promise<string> {
  if (!Number.isInteger(recId) || recId < 0)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  // userDir validates the username, so no path traversal (the legacy controller did not check).
  const dir = await userDir(assignmentId, problemId, username)
  const name = recId === 0 ? `${RECORD_FILE_NAME}.${RECORD_FILE_EXT}` : `${RECORD_FILE_NAME}-${recId}.${RECORD_FILE_EXT}`
  return join(dir, name)
}

export async function readRecordingFile(assignmentId: number, problemId: number, username: string, recId: number): Promise<string> {
  const path = await recordingFilePath(assignmentId, problemId, username, recId)
  try {
    return await readFile(path, 'utf8')
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: 'Recording file not found' })
  }
}

/** File type of the user's latest submission for a problem, used to pick the replay syntax mode. */
export async function recordingLanguage(assignmentId: number, problemId: number, username: string): Promise<string | null> {
  const [row] = await useDb().select({ fileType: submissions.fileType }).from(submissions)
    .where(and(eq(submissions.assignment, assignmentId), eq(submissions.problem, problemId), eq(submissions.username, username)))
    .orderBy(desc(submissions.submitId)).limit(1)
  return row?.fileType ?? null
}
