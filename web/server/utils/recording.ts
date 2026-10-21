import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

const { recording } = schema

/** Metrics object sent by the editor's recorder (legacy rec_metrics). */
export const recMetricsSchema = z.object({
  duration: z.coerce.number().default(0),
  origin: z.object({ inserted: z.coerce.number().default(0), removed: z.coerce.number().default(0) }).default({ inserted: 0, removed: 0 }),
  cct: z.object({ score: z.coerce.number().default(0) }).default({ score: 0 }),
  debugging: z.object({ input_change: z.coerce.number().default(0), execute: z.coerce.number().default(0) }).default({ input_change: 0, execute: 0 }),
  navigation: z.object({ total_in: z.coerce.number().default(0), total_out: z.coerce.number().default(0) }).default({ total_in: 0, total_out: 0 }),
  copyPaste: z.object({ max_inserted: z.coerce.number().default(0), max_removed: z.coerce.number().default(0) }).default({ max_inserted: 0, max_removed: 0 }),
}).passthrough()
export type RecMetrics = z.infer<typeof recMetricsSchema>

const uint = (n: number) => Math.max(0, Math.round(Number(n) || 0))

/** Inserts or replaces a recording row (legacy REPLACE INTO). */
export async function recordingSave(recId: number, username: string, assignment: number, problem: number, m: RecMetrics) {
  const values = {
    uploadAt: await nowStr(),
    duration: uint(m.duration),
    inserted: uint(m.origin.inserted),
    removed: uint(m.origin.removed),
    cct: Number(m.cct.score) || 0,
    totalInputChange: uint(m.debugging.input_change),
    totalExecute: uint(m.debugging.execute),
    totalNavIn: uint(m.navigation.total_in),
    totalNavOut: uint(m.navigation.total_out),
    maxInserted: uint(m.copyPaste.max_inserted),
    maxRemoved: uint(m.copyPaste.max_removed),
  }
  await useDb().insert(recording).values({ recId, username, assignment, problem, ...values })
    .onDuplicateKeyUpdate({ set: values })
}

export async function recordingRemoveDraft(username: string, assignment: number, problem: number) {
  await useDb().delete(recording).where(and(
    eq(recording.recId, 0),
    eq(recording.username, username),
    eq(recording.assignment, assignment),
    eq(recording.problem, problem),
  ))
}
