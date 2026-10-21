import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUser(event, 2)
  const items = await useDb().select().from(schema.queue).orderBy(asc(schema.queue.id))
  return { items, working: (await getSetting('queue_is_working')) === '1' }
})
