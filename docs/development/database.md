# Database

SharIF Judge uses MySQL or MariaDB (MariaDB 10.11 in Docker) through
[Drizzle ORM](https://orm.drizzle.team) on `mysql2`. The schema is the one the legacy CodeIgniter
installer created, unchanged, so the Nuxt app can run on an existing database. Two tables were
added for cheat detection.

| File | Purpose |
|---|---|
| [`web/server/database/schema.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/schema.ts) | Drizzle table definitions (what the code queries) |
| [`web/server/database/install.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/install.ts) | DDL of the legacy tables for a fresh install, and the default settings |
| [`web/server/database/migrate.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/migrate.ts) | DDL of tables added later, settings added later, legacy path fix-up |
| [`web/server/utils/db.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/db.ts) | `useDb()` (Drizzle), `usePool()` (raw `mysql2` pool), `tableName()`, `tableExists()` |

There is no migration tool such as `drizzle-kit migrate` in use. Tables are created by
`POST /api/install` (legacy tables + new tables) and by the start-up plugin (new tables only, with
`CREATE TABLE IF NOT EXISTS`).

## Conventions

**Table prefix.** All tables carry the prefix from `NUXT_DB_PREFIX` (default `shj_`). In Drizzle
code use `schema.<table>`; in raw SQL use `tableName('submissions')`.

**Datetimes are wall-clock strings.** Every `datetime` column holds local time in the time zone of
the `timezone` setting, as `YYYY-MM-DD HH:MM:SS`. The pool uses `dateStrings: true` and Drizzle
uses `mode: 'string'`, so values are never converted to or from UTC. Use `nowStr()` to get the
current value and `toEpoch()` / `fromEpoch()` for arithmetic
([`server/utils/time.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/time.ts)).
Changing the `timezone` setting does not rewrite stored times.

**Flags are `tinyint` 0/1**, and most numbers that came from PHP forms are stored as they were.
Settings values are always strings (`'0'` / `'1'` for switches).

**Few keys, no foreign keys.** The legacy schema has almost no primary or unique keys. A submission
is identified by the four columns `(submit_id, username, assignment, problem)`; a problem by
`(assignment, id)`. Deleting an assignment or a user is done in code
(`assignmentDelete()`, `deleteUser()`), including its files.

**Raw SQL** goes through `usePool().query(sql, params)` with `?` placeholders. Never concatenate
user input into SQL. Table names are not parameters, so they come from `tableName()`.

## Legacy tables

### `shj_users`

| Column | Meaning |
|---|---|
| `id` | auto increment |
| `username` | 3–20 characters `[a-z0-9]`. Compared case-sensitively in code although the collation is not. Used as the folder name under each problem. |
| `password` | bcrypt hash. PHP `$2y$` hashes are accepted. |
| `display_name` | shown in tables; can be locked for students (`lock_student_display_name`) |
| `email` | unique in practice (checked in code), max 40 |
| `role` | `admin`, `head_instructor`, `instructor`, `student` (levels 3–0, see [Architecture](./architecture#sign-in-session-and-permissions)) |
| `passchange_key`, `passchange_time` | password reset link key and when it was issued (valid for 1 hour) |
| `first_login_time`, `last_login_time` | set on sign-in |
| `selected_assignment` | the assignment the user is working on; 0 = none |
| `dashboard_widget_positions` | legacy draggable dashboard; not used by the Nuxt app (fixed layout) |

### `shj_assignments`

| Column | Meaning |
|---|---|
| `id` | auto increment, but new ids skip numbers whose `assignment_<id>` folder already exists (`assignmentNewId()`) |
| `name`, `description` | `description` is a legacy column; the Nuxt app writes an empty string |
| `problems` | number of problems |
| `total_submits` | counter; incremented atomically to produce the next `submit_id` (`submitNextId()`) |
| `open` | 0 = closed for students |
| `scoreboard` | 1 = scoreboard visible |
| `javaexceptions` | 1 = show names of listed Java exceptions in results |
| `start_time`, `finish_time` | wall-clock datetimes |
| `extra_time` | seconds after `finish_time` during which late submissions are accepted |
| `late_rule` | the coefficient rule: a PHP-style snippet, see [Late rule](#late-rule-and-coefficient) |
| `participants` | `ALL` or a comma-separated list of usernames |
| `moss_update` | when Moss last ran, or `Never` |
| `archived_assignment` | 1 = hidden from the dashboard |

### `shj_problems`

One row per problem; the key is `(assignment, id)` with `id` 1…n.

| Column | Meaning |
|---|---|
| `name`, `score` | `score` is the maximum points for the problem |
| `is_upload_only` | 1 = files are stored, not judged (status `Uploaded`) |
| `c_time_limit`, `python_time_limit`, `java_time_limit` | milliseconds (defaults 500, 1500, 2000) |
| `memory_limit` | kB (default 50000) |
| `allowed_languages` | comma-separated names: `C`, `C++`, `Python 2`, `Python 3`, `Java`, `JavaScript`, `Go`, `Zip`, `PDF`, `TXT` ([`shared/languages.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/shared/languages.ts)) |
| `diff_cmd`, `diff_arg` | output comparison, see [Judge engine](./judge-engine#comparing-output) |

### `shj_submissions`

| Column | Meaning |
|---|---|
| `submit_id` | per-assignment counter from `assignments.total_submits`. **`0` is the editor's temporary "Run"**, deleted after it finishes. |
| `username`, `assignment`, `problem` | together with `submit_id`, the key |
| `is_final` | 1 for the submission that counts. A newly judged submission becomes final automatically (rejudges keep the flag); users can pick another one (`/api/submissions/select-final`, students only until finish + extra time). At most one per user and problem. |
| `time` | wall-clock submit time |
| `status` | `PENDING`, `SCORE`, `Uploaded`, or an error such as `Compilation Error`, `Syntax Error`, `Judge Error` (max 100 characters) |
| `pre_score` | **0..10000**: the share of tests passed × 10000, from `tester.sh`. Not points. |
| `coefficient` | late coefficient in percent **as a string** of at most 6 characters (`"100"`, `"85"`, `"0"`), or **`"error"`** when the late rule failed. Computed at submit time, and recomputed for every submission of the assignment when its start, finish, extra time or late rule is edited (`updateCoefficients()` in `server/utils/assignments.ts`). |
| `file_name` | stored file name without extension, e.g. `Main-12` or `editor-12` |
| `main_file_name` | uploaded name without extension (`Main`), or `editor`; used as Java class name |
| `file_type` | `c`, `cpp`, `py2`, `py3`, `java`, `js`, `go`, `zip`, `pdf`, `txt` (max 6 characters) |

### `shj_queue`

Waiting judge jobs, processed in `id` order. Unique on `(submit_id, username, assignment, problem)`.
`type` is `judge` (new submission), `rejudge` or `exec` (editor Run). A row is removed after its
result is stored. See [Architecture](./architecture#the-judge-queue).

### `shj_settings`

Key/value rows: `shj_key` (max 50), `shj_value` (text). There is an index but **no unique key**, so
insert new keys only after checking they do not exist (see [Settings](#settings)).

### `shj_notifications`

`id`, `title`, `text` (HTML, sanitized on save), `time`.

### `shj_scoreboard`

Legacy cache of rendered scoreboard HTML per assignment. **Ignored** by the Nuxt app, which computes
scoreboards from `shj_submissions` on each request
([`server/utils/scoreboard.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/scoreboard.ts)).

### `shj_logins`

24-hour sign-in log: `login_id`, `username`, `ip_address`, `timestamp`, `last_24h_login_id` (link to
the user's previous login from a different address). Entries older than a day are deleted on each
sign-in. `ip_address` is `varchar(15)`, so IPv6 addresses are cut off; this is a known limitation
of the legacy schema.

### `shj_recording`

Metrics of the editor recordings, one row per `(rec_id, username, assignment, problem)`. `rec_id` is
the submit id of the submission the recording belongs to, or **0 for the current draft**. The
columns (`duration`, `inserted`, `removed`, `cct`, `total_input_change`, `total_execute`,
`total_nav_in`, `total_nav_out`, `max_inserted`, `max_removed`) are the metrics the recorder
computes in the browser (`app/utils/editor-recorder.ts`). The keystroke recording itself is a file,
`record.json` / `record-<id>.json`, in the user's folder.

## Cheat detection tables

Added by the Nuxt app, created by `migrate.ts`. Their names also use the prefix.

### `shj_cheat_runs`

| Column | Meaning |
|---|---|
| `id` | auto increment |
| `assignment`, `problem`, `language` | what was compared; `language` is the JPlag language `c`, `cpp`, `java`, `python3`, `javascript` or `go` |
| `status` | `queued`, `running`, `done`, `failed` |
| `options` | JSON `{ minTokens, compareAssignments, baseCode }` |
| `created_at`, `finished_at` | wall-clock datetimes |
| `submissions`, `comparisons` | counts from the JPlag run |
| `failed` | JSON list of submissions JPlag could not parse |
| `error` | failure message, or notes (e.g. "sensitivity was raised automatically") |

Only the latest finished run per assignment, problem and language is kept; older ones and their
pairs are deleted when a run finishes.

### `shj_cheat_pairs`

| Column | Meaning |
|---|---|
| `run_id` | the run |
| `user_a`, `submit_a` | always a submission of the checked assignment |
| `user_b`, `submit_b`, `assignment_b`, `problem_b` | the other submission; another assignment when comparing with older work |
| `similarity` | average similarity 0..1 |
| `max_similarity` | similarity relative to the smaller program, 0..1 |
| `longest_match` | tokens in the longest matching section |
| `matches` | JSON list of `[aStartLine, aEndLine, bStartLine, bEndLine, tokens]` |

Pairs under 5 % average similarity are not stored, nor pairs whose longest match is under 6 tokens
unless their maximum similarity is at least 60 %.

## Late rule and coefficient

`assignments.late_rule` is stored in the legacy PHP form, for example:

```php
if ($delay<=0)
  $coefficient = 100;
elseif ($delay<=3600)
  $coefficient = ceil(100-((30*$delay)/3600));
```

[`server/utils/late-rule.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/late-rule.ts)
translates it to JavaScript (`$x` → `x`, `elseif` → `else if`, `and`/`or` → `&&`/`||`) and runs it
in `node:vm` with a 100 ms timeout. `delay` is seconds after `finish_time` (negative before) and
`extra_time` is the assignment's extra time in seconds. Only `ceil`, `floor`, `round`, `abs`, `min`,
`max` and `intval` are available. The result is cut to 6 characters; anything that is not a finite
number gives `"error"`. Rules that do not compile are refused when an assignment is saved.

Scores are derived on read, never stored:

```ts
// computeScores(preScoreRaw, problemScore, coefficient)
preScore   = ceil(pre_score * problem.score / 10000)
finalScore = coefficient === 'error' ? 0 : ceil(preScore * Number(coefficient) / 100)
```

The scoreboard sums `finalScore` of final submissions, and breaks ties by time since the start plus
`submit_penalty` seconds per submission. The Hall of Fame uses the legacy formula
`CEILING(SUM(pre_score * coefficient / 10000))` over all final, non-upload submissions.

## Settings

All keys, created by `/install` from `defaultSettings()` in `install.ts` (and, for keys added later,
by `migrate.ts`). Values are strings.

| Key | Default | Meaning |
|---|---|---|
| `timezone` | `Asia/Jakarta` | IANA zone of all stored datetimes |
| `tester_path` | `NUXT_PATHS_TESTER` | folder with `tester.sh` (web side; the judge container uses `/app/tester`) |
| `assignments_root` | `NUXT_PATHS_ASSIGNMENTS` | root of the assignment folders; `/data/assignments` in Docker |
| `file_size_limit` | `50` | maximum upload size in KB (0 = no limit) |
| `output_size_limit` | `1024` | maximum program output per test in KB |
| `queue_is_working` | `0` | runtime flag: 1 while the queue loop runs; pause sets it to 0 |
| `default_late_rule` | the rule above | pre-filled rule for new assignments |
| `enable_easysandbox` | `1` | passed to `tester.sh`; no effect because EasySandbox is not built |
| `enable_c_shield`, `enable_cpp_shield` | `1` | C / C++ shield |
| `enable_py2_shield`, `enable_py3_shield` | `1` | Python shields |
| `enable_java_policy` | `1` | Java Security Manager with an empty policy |
| `enable_log` | `1` | write the judge log (`log-<id>`) |
| `submit_penalty` | `300` | seconds added per submission in the scoreboard tie-break |
| `enable_registration` | `0` | self registration on `/register` |
| `registration_code` | `0` | code required to register; `0` = no code |
| `mail_from`, `mail_from_name` | `no-reply@example.com`, `SharIF Judge` | sender of mails |
| `reset_password_mail`, `add_user_mail` | HTML templates | with placeholders such as `{SITE_URL}`, `{RESET_LINK}`, `{USERNAME}`, `{PASSWORD}` |
| `moss_userid` | empty | Moss account id (digits only) |
| `results_per_page_all`, `results_per_page_final` | `40`, `80` | page sizes of the submission lists |
| `week_start` | `0` | first day of the dashboard calendar, 0 = Sunday … 6 |
| `lock_student_display_name` | `0` | students cannot change their display name |
| `enable_python2` | `0` | Python 2 offered and accepted (added after the legacy schema) |

The TypeScript list of keys is the `SettingKey` type in
[`server/utils/settings.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/settings.ts).

## Rules

::: danger Never change legacy tables
Do not add, remove, rename or retype columns or keys of the `shj_` tables from the legacy schema.
Existing installations run on those tables, the migration guide promises that an installation can
switch from PHP and back, and the regression test compares with the PHP app on the same schema.
If you need more data, add a new table.
:::

Corollaries: `shj_logins.ip_address` stays 15 characters, `file_type` and `coefficient` stay 6, and
the settings table keeps having no unique key.

## Adding a table

1. Add the `CREATE TABLE IF NOT EXISTS` statement to `extraTablesSql(p)` in
   [`migrate.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/migrate.ts).
   Use the prefix `p`, `ENGINE=InnoDB` and `utf8mb4_general_ci` are appended for you. Use
   `datetime` for times (wall clock, like the rest).
2. Add the same table to [`schema.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/schema.ts)
   with `table('<name>', { ... })` and the `dt()` helper for datetimes. Keep the two definitions in
   sync by hand.
3. Restart the app. `migrateExtraTables()` creates the table on start-up on existing installations;
   `/install` creates it on new ones (it runs `extraTablesSql` too).
4. Code that may run before the migration finished (for example another start-up plugin) should
   check `tableExists('<name>')` first, as `server/plugins/migrate.ts` does for `cheat_runs`.

`CREATE TABLE IF NOT EXISTS` never alters an existing table. To change a table you added, write an
explicit, idempotent step in `migrate.ts` (check `information_schema` before an `ALTER TABLE`) and
test it on a database that already has the old version.

## Adding a setting

1. Add the key to the `SettingKey` type in `server/utils/settings.ts`.
2. Add the default to `defaultSettings()` in `install.ts` (fresh installs).
3. Add the same default to `EXTRA_SETTINGS` in `migrate.ts` (existing installs). This is required:
   `setSetting()` only updates existing rows, so a key that was never inserted cannot be saved.
4. Read it with `getSetting('<key>')`. If admins should change it, add it to
   `server/api/settings/index.get.ts`, the zod schema and `setSettings()` call in
   `server/api/settings/index.post.ts`, and the form in `app/pages/settings.vue`.

`enable_python2` is a complete example of these steps, and `tests/e2e/python2.py` tests that an
existing installation without the key gets it on restart.
