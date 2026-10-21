// Everything the dashboard page shows, in one request.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const now = await nowStr()
  const [notifications, assignments, weekStart, stats, errors] = await Promise.all([
    notificationsLatest(),
    dashboardAssignments(),
    getSetting('week_start'),
    dashboardStats(user.username, user.level, now),
    user.level >= 3 ? dashboardErrors() : Promise.resolve([]),
  ])
  return {
    serverTime: now,
    weekStart: Math.min(6, Math.max(0, Number(weekStart) || 0)),
    notifications,
    assignments: assignments.map(a => ({ ...a, open: Boolean(a.open) })),
    stats,
    errors,
  }
})
