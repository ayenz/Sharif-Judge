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
export async function dashboardErrors(): Promise<{ message: string, path?: string, kind?: 'folder' | 'backup' }[]> {
  const errors: { message: string, path?: string, kind?: 'folder' | 'backup' }[] = []
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
  errors.push(...(await backupWarnings()).map(message => ({ message, kind: 'backup' as const })))
  return errors
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
