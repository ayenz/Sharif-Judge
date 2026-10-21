import { asc } from 'drizzle-orm'

const { assignments } = schema

// Lightweight list for the assignment switcher.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const rows = await useDb().select({
    id: assignments.id,
    name: assignments.name,
    archived: assignments.archivedAssignment,
  }).from(assignments).orderBy(asc(assignments.id))
  return rows.map(r => ({ ...r, archived: Boolean(r.archived) }))
})
