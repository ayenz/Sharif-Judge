import { migrateExtraTables, migrateLegacyPaths } from '../database/migrate'
import { inArray } from 'drizzle-orm'

// Creates tables added after the legacy schema and clears cheat detection runs
// that were interrupted by a restart.
export default defineNitroPlugin(() => {
  if (import.meta.prerender)
    return
  setTimeout(async () => {
    try {
      await migrateExtraTables()
      await migrateLegacyPaths()
      if (await tableExists('cheat_runs')) {
        await useDb().update(schema.cheatRuns)
          .set({ status: 'failed', error: 'Interrupted by a server restart.' })
          .where(inArray(schema.cheatRuns.status, ['queued', 'running']))
      }
    }
    catch (error) {
      console.warn('[migrate] failed:', (error as Error).message)
    }
  }, 500)
})
