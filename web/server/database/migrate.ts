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

export async function migrateExtraTables(): Promise<void> {
  if (!(await tableExists('settings')))
    return
  for (const sql of extraTablesSql(useRuntimeConfig().db.prefix))
    await usePool().query(sql)
}
