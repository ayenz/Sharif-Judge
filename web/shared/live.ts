// Events pushed to browsers over /api/events.

export type LiveEvent =
  /** A submission finished judging (judge or rejudge). */
  | { type: 'judged', username: string, assignment: number, problem: number, submitId: number, status: string, preScore: number }
  /** An editor "Run" finished; the output can be fetched. */
  | { type: 'executed', username: string, assignment: number, problem: number }
  /** The judge queue changed (staff). */
  | { type: 'queue', length: number }
  /** A cheat detection run changed status (staff). */
  | { type: 'cheat', assignment: number, runId: number, status: string }
  /** A notification was posted or edited. */
  | { type: 'notification', id: number, title: string }
