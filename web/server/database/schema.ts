// Mirrors the tables created by the legacy CodeIgniter installer, so an existing
// SharIF Judge database can be used as-is.
import {
  mysqlTableCreator,
  int,
  smallint,
  tinyint,
  varchar,
  text,
  datetime,
  timestamp,
  float,
  mediumtext,
} from 'drizzle-orm/mysql-core'

const prefix = process.env.NUXT_DB_PREFIX ?? 'shj_'
const table = mysqlTableCreator(name => `${prefix}${name}`)

// Datetimes are stored as wall-clock strings in the timezone from settings.
const dt = (name: string) => datetime(name, { mode: 'string' })

export const users = table('users', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  username: varchar('username', { length: 20 }).notNull(),
  password: varchar('password', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 40 }).notNull().default(''),
  email: varchar('email', { length: 40 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  passchangeKey: varchar('passchange_key', { length: 60 }).notNull().default(''),
  passchangeTime: dt('passchange_time'),
  firstLoginTime: dt('first_login_time'),
  lastLoginTime: dt('last_login_time'),
  selectedAssignment: smallint('selected_assignment', { unsigned: true }).notNull().default(0),
  dashboardWidgetPositions: varchar('dashboard_widget_positions', { length: 500 }).notNull().default(''),
})

export const assignments = table('assignments', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull().default(''),
  problems: smallint('problems', { unsigned: true }).notNull(),
  totalSubmits: int('total_submits', { unsigned: true }).notNull(),
  open: tinyint('open').notNull(),
  scoreboard: tinyint('scoreboard').notNull(),
  javaexceptions: tinyint('javaexceptions').notNull(),
  description: text('description').notNull(),
  startTime: dt('start_time').notNull(),
  finishTime: dt('finish_time').notNull(),
  extraTime: int('extra_time').notNull(),
  lateRule: text('late_rule').notNull(),
  participants: text('participants').notNull(),
  mossUpdate: varchar('moss_update', { length: 30 }).notNull().default('Never'),
  archivedAssignment: tinyint('archived_assignment').notNull(),
})

export const problems = table('problems', {
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  id: smallint('id', { unsigned: true }).notNull(),
  name: varchar('name', { length: 50 }).notNull().default(''),
  score: int('score').notNull(),
  isUploadOnly: tinyint('is_upload_only').notNull().default(0),
  cTimeLimit: int('c_time_limit', { unsigned: true }).notNull().default(500),
  pythonTimeLimit: int('python_time_limit', { unsigned: true }).notNull().default(1500),
  javaTimeLimit: int('java_time_limit', { unsigned: true }).notNull().default(2000),
  memoryLimit: int('memory_limit', { unsigned: true }).notNull().default(50000),
  allowedLanguages: text('allowed_languages').notNull(),
  diffCmd: varchar('diff_cmd', { length: 20 }).notNull().default('diff'),
  diffArg: varchar('diff_arg', { length: 20 }).notNull().default('-bB'),
})

export const submissions = table('submissions', {
  submitId: int('submit_id', { unsigned: true }).notNull(),
  username: varchar('username', { length: 20 }).notNull(),
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  problem: smallint('problem', { unsigned: true }).notNull(),
  isFinal: tinyint('is_final').notNull().default(0),
  time: dt('time').notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  preScore: int('pre_score').notNull(),
  coefficient: varchar('coefficient', { length: 6 }).notNull(),
  fileName: varchar('file_name', { length: 100 }).notNull(),
  mainFileName: varchar('main_file_name', { length: 100 }).notNull(),
  fileType: varchar('file_type', { length: 6 }).notNull(),
})

export const queue = table('queue', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  submitId: int('submit_id', { unsigned: true }).notNull(),
  username: varchar('username', { length: 20 }).notNull(),
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  problem: smallint('problem', { unsigned: true }).notNull(),
  type: varchar('type', { length: 8 }).notNull(),
})

export const settings = table('settings', {
  key: varchar('shj_key', { length: 50 }).notNull(),
  value: text('shj_value').notNull(),
})

export const notifications = table('notifications', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  title: varchar('title', { length: 200 }).notNull().default(''),
  text: text('text').notNull(),
  time: dt('time').notNull(),
})

export const scoreboard = table('scoreboard', {
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  scoreboard: text('scoreboard').notNull(),
})

export const logins = table('logins', {
  loginId: int('login_id', { unsigned: true }).autoincrement().primaryKey(),
  username: varchar('username', { length: 20 }).notNull(),
  ipAddress: varchar('ip_address', { length: 15 }).notNull(),
  timestamp: timestamp('timestamp', { mode: 'string' }).notNull(),
  last24hLoginId: int('last_24h_login_id'),
})

export const recording = table('recording', {
  recId: int('rec_id', { unsigned: true }).notNull(),
  uploadAt: dt('upload_at').notNull(),
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  problem: smallint('problem', { unsigned: true }).notNull(),
  username: varchar('username', { length: 20 }).notNull(),
  duration: int('duration', { unsigned: true }).notNull(),
  inserted: int('inserted', { unsigned: true }).notNull(),
  removed: int('removed', { unsigned: true }).notNull(),
  cct: float('cct').notNull(),
  totalInputChange: int('total_input_change', { unsigned: true }).notNull(),
  totalExecute: int('total_execute', { unsigned: true }).notNull(),
  totalNavIn: int('total_nav_in', { unsigned: true }).notNull(),
  totalNavOut: int('total_nav_out', { unsigned: true }).notNull(),
  maxInserted: int('max_inserted', { unsigned: true }).notNull(),
  maxRemoved: int('max_removed', { unsigned: true }).notNull(),
})

// ---------------------------------------------------------------------------
// Cheat detection (new in the Nuxt version; created by server/database/migrate.ts)

export const cheatRuns = table('cheat_runs', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  assignment: smallint('assignment', { unsigned: true }).notNull(),
  problem: smallint('problem', { unsigned: true }).notNull(),
  /** JPlag language: c, cpp, java, python3, kotlin, javascript, go or swift. */
  language: varchar('language', { length: 10 }).notNull(),
  /** queued, running, done or failed. */
  status: varchar('status', { length: 10 }).notNull(),
  /** JSON: { minTokens, compareAssignments, baseCode }. */
  options: text('options').notNull(),
  createdAt: dt('created_at').notNull(),
  finishedAt: dt('finished_at'),
  submissions: int('submissions', { unsigned: true }).notNull().default(0),
  comparisons: int('comparisons', { unsigned: true }).notNull().default(0),
  /** JSON list of submission ids JPlag could not parse. */
  failed: text('failed').notNull(),
  error: text('error').notNull(),
})

export const cheatPairs = table('cheat_pairs', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  runId: int('run_id', { unsigned: true }).notNull(),
  /** Submission A always belongs to the checked assignment. */
  userA: varchar('user_a', { length: 20 }).notNull(),
  submitA: int('submit_a', { unsigned: true }).notNull(),
  userB: varchar('user_b', { length: 20 }).notNull(),
  submitB: int('submit_b', { unsigned: true }).notNull(),
  /** Assignment and problem of B: differs from A when B is an older submission. */
  assignmentB: smallint('assignment_b', { unsigned: true }).notNull(),
  problemB: smallint('problem_b', { unsigned: true }).notNull(),
  similarity: float('similarity').notNull(),
  maxSimilarity: float('max_similarity').notNull(),
  longestMatch: int('longest_match', { unsigned: true }).notNull(),
  /** JSON list of [aStartLine, aEndLine, bStartLine, bEndLine, tokens]. */
  matches: mediumtext('matches').notNull(),
})
