import { access } from 'node:fs/promises'

// Tables added after the legacy schema. Created on startup (and on install) with
// CREATE TABLE IF NOT EXISTS, so existing installations upgrade themselves.

export function extraTablesSql(p: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS \`${p}cheat_runs\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`problem\` smallint(4) unsigned NOT NULL,
      \`language\` varchar(10) NOT NULL,
      \`status\` varchar(10) NOT NULL,
      \`options\` text NOT NULL,
      \`created_at\` datetime NOT NULL,
      \`finished_at\` datetime DEFAULT NULL,
      \`submissions\` int(11) unsigned NOT NULL DEFAULT 0,
      \`comparisons\` int(11) unsigned NOT NULL DEFAULT 0,
      \`failed\` text NOT NULL,
      \`error\` text NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`assignment_problem\` (\`assignment\`, \`problem\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}cheat_pairs\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`run_id\` int(11) unsigned NOT NULL,
      \`user_a\` varchar(20) NOT NULL,
      \`submit_a\` int(11) unsigned NOT NULL,
      \`user_b\` varchar(20) NOT NULL,
      \`submit_b\` int(11) unsigned NOT NULL,
      \`assignment_b\` smallint(4) unsigned NOT NULL,
      \`problem_b\` smallint(4) unsigned NOT NULL,
      \`similarity\` float NOT NULL,
      \`max_similarity\` float NOT NULL,
      \`longest_match\` int(11) unsigned NOT NULL,
      \`matches\` mediumtext NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`run_similarity\` (\`run_id\`, \`similarity\`)
    )`,
  ].map(sql => `${sql} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`)
}

/** Settings added after the legacy schema, with their default for existing installs. */
const EXTRA_SETTINGS: Record<string, string> = {
  enable_python2: '0',
  enable_turnstile: '0',
}

export async function migrateExtraTables(): Promise<void> {
  if (!(await tableExists('settings')))
    return
  const pool = usePool()
  for (const sql of extraTablesSql(useRuntimeConfig().db.prefix))
    await pool.query(sql)
  // The settings table has no unique key, so insert missing keys one by one.
  const table = tableName('settings')
  for (const [key, value] of Object.entries(EXTRA_SETTINGS)) {
    const [rows] = await pool.query(`SELECT 1 FROM \`${table}\` WHERE shj_key = ? LIMIT 1`, [key])
    if (!(rows as unknown[]).length)
      await pool.query(`INSERT INTO \`${table}\` (shj_key, shj_value) VALUES (?, ?)`, [key, value])
  }
}

/**
 * A database taken over from the PHP version stores the PHP install's folders
 * (e.g. /var/www/html/restricted/tester). When such a folder does not exist here but
 * the configured one (NUXT_PATHS_*) does, switch the setting to it. Valid paths are
 * never changed.
 */
export async function migrateLegacyPaths(): Promise<void> {
  if (!(await tableExists('settings')))
    return
  const { paths } = useRuntimeConfig()
  const exists = (path: string) => access(path).then(() => true, () => false)
  for (const [key, configured] of [['tester_path', paths.tester], ['assignments_root', paths.assignments]] as const) {
    if (!configured)
      continue
    const stored = await getSetting(key)
    if (stored === configured || (stored && await exists(stored)) || !(await exists(configured)))
      continue
    await setSetting(key, configured)
    console.warn(`[migrate] ${key}: "${stored}" does not exist here, using "${configured}"`)
  }
}
