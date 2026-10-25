// Fresh-install DDL. Matches the schema created by the legacy installer so both
// apps can share a database.

export const DEFAULT_LATE_RULE = `/*
 * Put coefficient (from 100) in variable $coefficient.
 * You can use variables $extra_time and $delay.
 * $extra_time is the total extra time given to users
 * (in seconds) and $delay is number of seconds passed
 * from finish time (can be negative).
 *  In this example, $extra_time is 172800 (2 days):
 */

if ($delay<=0)
  // no delay
  $coefficient = 100;

elseif ($delay<=3600)
  // delay less than 1 hour
  $coefficient = ceil(100-((30*$delay)/3600));

elseif ($delay<=86400)
  // delay more than 1 hour and less than 1 day
  $coefficient = 70;

elseif (($delay-86400)<=3600)
  // delay less than 1 hour in second day
  $coefficient = ceil(70-((20*($delay-86400))/3600));

elseif (($delay-86400)<=86400)
  // delay more than 1 hour in second day
  $coefficient = 50;

elseif ($delay > $extra_time)
  // too late
  $coefficient = 0;`

const RESET_PASSWORD_MAIL = `<p>
Someone requested a password reset for your SharIF Judge account at {SITE_URL}.
</p>
<p>
To change your password, visit this link:
</p>
<p>
<a href="{RESET_LINK}">Reset Password</a>
</p>
<p>
The link is valid for {VALID_TIME}. If you don't want to change your password, just ignore this email.
</p>`

const ADD_USER_MAIL = `<p>
Hello! You are registered in SharIF Judge at {SITE_URL} as {ROLE}.
</p>
<p>
Your username: {USERNAME}
</p>
<p>
Your password: {PASSWORD}
</p>
<p>
You can log in at <a href="{LOGIN_URL}">{LOGIN_URL}</a>
</p>`

export function defaultSettings(paths: { tester: string, assignments: string }): Record<string, string> {
  return {
    timezone: 'Asia/Jakarta',
    tester_path: paths.tester,
    assignments_root: paths.assignments,
    file_size_limit: '50',
    output_size_limit: '1024',
    queue_is_working: '0',
    default_late_rule: DEFAULT_LATE_RULE,
    enable_easysandbox: '1',
    enable_c_shield: '1',
    enable_cpp_shield: '1',
    enable_py2_shield: '1',
    enable_py3_shield: '1',
    enable_java_policy: '1',
    enable_log: '1',
    submit_penalty: '300',
    enable_registration: '0',
    registration_code: '0',
    mail_from: 'no-reply@example.com',
    mail_from_name: 'SharIF Judge',
    reset_password_mail: RESET_PASSWORD_MAIL,
    add_user_mail: ADD_USER_MAIL,
    moss_userid: '',
    results_per_page_all: '40',
    results_per_page_final: '80',
    week_start: '0',
    lock_student_display_name: '0',
    enable_python2: '0',
    enable_turnstile: '0',
  }
}

export function createTablesSql(p: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS \`${p}assignments\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`name\` varchar(50) NOT NULL DEFAULT '',
      \`problems\` smallint(4) unsigned NOT NULL,
      \`total_submits\` int(11) unsigned NOT NULL,
      \`open\` tinyint(1) NOT NULL,
      \`scoreboard\` tinyint(1) NOT NULL,
      \`javaexceptions\` tinyint(1) NOT NULL,
      \`description\` text NOT NULL,
      \`start_time\` datetime NOT NULL,
      \`finish_time\` datetime NOT NULL,
      \`extra_time\` int(11) NOT NULL,
      \`late_rule\` text NOT NULL,
      \`participants\` text NOT NULL,
      \`moss_update\` varchar(30) NOT NULL DEFAULT 'Never',
      \`archived_assignment\` tinyint(1) NOT NULL,
      PRIMARY KEY (\`id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}logins\` (
      \`login_id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`username\` varchar(20) NOT NULL,
      \`ip_address\` varchar(15) NOT NULL,
      \`timestamp\` timestamp NOT NULL,
      \`last_24h_login_id\` int(11) DEFAULT NULL,
      PRIMARY KEY (\`login_id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}notifications\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`title\` varchar(200) NOT NULL DEFAULT '',
      \`text\` text NOT NULL,
      \`time\` datetime NOT NULL,
      PRIMARY KEY (\`id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}problems\` (
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`id\` smallint(4) unsigned NOT NULL,
      \`name\` varchar(50) NOT NULL DEFAULT '',
      \`score\` int(11) NOT NULL,
      \`is_upload_only\` tinyint(1) NOT NULL DEFAULT 0,
      \`c_time_limit\` int(11) unsigned NOT NULL DEFAULT 500,
      \`python_time_limit\` int(11) unsigned NOT NULL DEFAULT 1500,
      \`java_time_limit\` int(11) unsigned NOT NULL DEFAULT 2000,
      \`memory_limit\` int(11) unsigned NOT NULL DEFAULT 50000,
      \`allowed_languages\` text NOT NULL,
      \`diff_cmd\` varchar(20) NOT NULL DEFAULT 'diff',
      \`diff_arg\` varchar(20) NOT NULL DEFAULT '-bB',
      KEY \`assignment_id\` (\`assignment\`,\`id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}queue\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`submit_id\` int(11) unsigned NOT NULL,
      \`username\` varchar(20) NOT NULL,
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`problem\` smallint(4) unsigned NOT NULL,
      \`type\` varchar(8) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`${p}suap_unique\` (\`submit_id\`,\`username\`,\`assignment\`,\`problem\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}recording\` (
      \`rec_id\` int(11) unsigned NOT NULL,
      \`upload_at\` datetime NOT NULL,
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`problem\` smallint(4) unsigned NOT NULL,
      \`username\` varchar(20) NOT NULL,
      \`duration\` int(11) unsigned NOT NULL,
      \`inserted\` int(11) unsigned NOT NULL,
      \`removed\` int(11) unsigned NOT NULL,
      \`cct\` float NOT NULL,
      \`total_input_change\` int(11) unsigned NOT NULL,
      \`total_execute\` int(11) unsigned NOT NULL,
      \`total_nav_in\` int(11) unsigned NOT NULL,
      \`total_nav_out\` int(11) unsigned NOT NULL,
      \`max_inserted\` int(11) unsigned NOT NULL,
      \`max_removed\` int(11) unsigned NOT NULL,
      UNIQUE KEY \`${p}ruap_unique\` (\`rec_id\`,\`username\`,\`assignment\`,\`problem\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}scoreboard\` (
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`scoreboard\` text NOT NULL,
      KEY \`assignment\` (\`assignment\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}settings\` (
      \`shj_key\` varchar(50) NOT NULL,
      \`shj_value\` text NOT NULL,
      KEY \`shj_key\` (\`shj_key\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}submissions\` (
      \`submit_id\` int(11) unsigned NOT NULL,
      \`username\` varchar(20) NOT NULL,
      \`assignment\` smallint(4) unsigned NOT NULL,
      \`problem\` smallint(4) unsigned NOT NULL,
      \`is_final\` tinyint(1) NOT NULL DEFAULT 0,
      \`time\` datetime NOT NULL,
      \`status\` varchar(100) NOT NULL,
      \`pre_score\` int(11) NOT NULL,
      \`coefficient\` varchar(6) NOT NULL,
      \`file_name\` varchar(100) NOT NULL,
      \`main_file_name\` varchar(100) NOT NULL,
      \`file_type\` varchar(6) NOT NULL,
      KEY \`assignment_submit_id\` (\`assignment\`,\`submit_id\`)
    )`,
    `CREATE TABLE IF NOT EXISTS \`${p}users\` (
      \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT,
      \`username\` varchar(20) NOT NULL,
      \`password\` varchar(100) NOT NULL,
      \`display_name\` varchar(40) NOT NULL DEFAULT '',
      \`email\` varchar(40) NOT NULL,
      \`role\` varchar(20) NOT NULL,
      \`passchange_key\` varchar(60) NOT NULL DEFAULT '',
      \`passchange_time\` datetime DEFAULT NULL,
      \`first_login_time\` datetime DEFAULT NULL,
      \`last_login_time\` datetime DEFAULT NULL,
      \`selected_assignment\` smallint(4) unsigned NOT NULL DEFAULT 0,
      \`dashboard_widget_positions\` varchar(500) NOT NULL DEFAULT '',
      PRIMARY KEY (\`id\`),
      KEY \`username\` (\`username\`)
    )`,
  ].map(sql => `${sql} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`)
}
