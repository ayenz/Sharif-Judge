import { asc, count, eq, gte } from 'drizzle-orm'

const { assignments, submissions, notifications, users } = schema

/** Non-archived assignments for the dashboard calendar and deadline list. */
export async function dashboardAssignments() {
  return useDb().select({
    id: assignments.id,
    name: assignments.name,
    open: assignments.open,
    problems: assignments.problems,
    startTime: assignments.startTime,
    finishTime: assignments.finishTime,
    extraTime: assignments.extraTime,
  }).from(assignments).where(eq(assignments.archivedAssignment, 0)).orderBy(asc(assignments.id))
}

/** Folder warnings shown to admins (legacy Dashboard controller). */
export async function dashboardErrors(): Promise<{ message: string, path?: string }[]> {
  const errors: { message: string, path?: string }[] = []
  const checks = [
    { key: 'assignments_root' as const, name: 'assignments', note: ' Codes will be saved in this folder!' },
    { key: 'tester_path' as const, name: 'tester', note: '' },
  ]
  for (const c of checks) {
    const path = await getSetting(c.key)
    if (!await settingsPathExists(path))
      errors.push({ message: `The path to folder "${c.name}" is not set correctly. Move this folder somewhere not publicly accessible, and set its full path in Settings.` })
    else if (!await settingsPathWritable(path))
      errors.push({ path, message: `This folder is not writable by the server. Make it writable, but make sure that this folder is only accessible by you.${c.note}` })
  }
  errors.push(...await dashboardBackupWarnings())
  return errors
}

/** Admin warnings about the backup service (latest.json written by docker/backup/backup.sh). */
async function dashboardBackupWarnings(): Promise<{ message: string }[]> {
  const dir = useRuntimeConfig().backup.dir
  if (!dir)
    return []
  const { readFile } = await import('node:fs/promises')
  const text = await readFile(`${dir}/latest.json`, 'utf8').catch(() => null)
  if (text === null)
    return [{ message: 'No backup has been made yet. The backup service runs once a day; see docker/README.md to run one now.' }]
  try {
    const last = JSON.parse(text) as { time: string, status: string, message: string }
    if (last.status !== 'ok')
      return [{ message: `The last backup failed (${last.time}): ${last.message}.` }]
    const age = toEpoch(await nowStr()) - toEpoch(last.time)
    if (age > 2 * 86400)
      return [{ message: `The last backup is from ${last.time}, more than two days ago. Check the backup service.` }]
  }
  catch {
    return [{ message: 'The backup status file cannot be read.' }]
  }
  return []
}

/** Cheap counters for the stat cards. */
export async function dashboardStats(username: string, level: number, now: string) {
  const db = useDb()
  const weekAgo = fromEpoch(toEpoch(now) - 7 * 86400)
  const [[mine], [recent], [userCount]] = await Promise.all([
    db.select({ n: count() }).from(submissions).where(eq(submissions.username, username)),
    db.select({ n: count() }).from(notifications).where(gte(notifications.time, weekAgo)),
    level >= 3 ? db.select({ n: count() }).from(users) : Promise.resolve([undefined]),
  ])
  return {
    mySubmissions: mine?.n ?? 0,
    recentNotifications: recent?.n ?? 0,
    users: userCount?.n ?? null,
  }
}
