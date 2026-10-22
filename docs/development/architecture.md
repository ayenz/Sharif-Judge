# Architecture

SharIF Judge is one Nuxt application plus a small, isolated worker that runs submitted code. The
app replaced a CodeIgniter 3 / PHP version but kept its database schema, its assignment folder
layout and its Bash judging engine, so an existing installation can switch over without converting
data. Many details below follow from that decision.

## Services

`docker/compose.yml` defines four services (plus `ci3`, the legacy app, only for tests):

| Service | Image | Runs | Network | Data |
|---|---|---|---|---|
| `db` | `mariadb:10.11` | MariaDB | Compose network | volume `db` |
| `web` | `sharif-judge-web` | Nuxt server as `node` (uid 1000), port 3000 → 8402 | Compose network | volume `web-data` at `/data`; backups read-only at `/backups`, writable `/backups/control` |
| `judge` | same image | `node /app/judge/worker.mjs` as root, programs as `shjrun` (uid 2000) | **none** | volume `web-data` at `/data` |
| `backup` | `mariadb:10.11` | `docker/backup/backup.sh` | Compose network | `web-data` read-only, `BACKUP_DIR` at `/backups` |

```
                 browser
                    │  HTTPS (reverse proxy) / HTTP :8402
                    ▼
 ┌─────────────────────────────────────────────┐        ┌──────────────┐
 │ web  (Nuxt / Nitro, uid 1000)               │  SQL   │ db           │
 │  pages (SSR) · /api/** · /api/events (SSE)  │◄──────►│ MariaDB      │
 │  queue worker · cheat worker (JPlag)        │        │ shj_* tables │
 └──────┬──────────────────────────▲───────────┘        └──────▲───────┘
        │ /data/jobs/<id>.job.json │ <id>.result.json          │ dump
        ▼                          │                    ┌──────┴───────┐
 ┌─────────────────────────────────┴───────────┐        │ backup       │
 │ judge  (no network, no secrets)             │        │ backup.sh    │
 │  worker.mjs → bash tester.sh → runcode.sh   │        └──────┬───────┘
 │  compiles/runs as shjrun (uid 2000) in jail │               │ tar
 └──────────────────────┬──────────────────────┘               │
                        ▼                                      ▼
        /data/assignments/assignment_<a>/p<p>/...    (shared volume web-data)
```

## The web process

[`web/`](https://github.com/ayenz/Sharif-Judge/blob/main/web/README.md) is a single Nitro
node-server process. It does four jobs:

- **Server-side rendering** of the Vue pages in `app/pages/` (Nuxt UI 4, Tailwind 4).
- **The JSON API** in `server/api/`, one file per route and method (`index.get.ts`,
  `[id].post.ts`). Helpers in `server/utils/` are auto-imported everywhere on the server.
- **The judge queue**: a background loop inside the same process
  ([`server/utils/queue.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/queue.ts)).
- **Cheat detection**: a second background loop that runs JPlag
  ([`server/utils/cheat.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/cheat.ts)).

Several things assume there is **exactly one web process**: the queue loop, the in-memory
rate-limit counters and the in-memory event bus for live updates. `NUXT_QUEUE_ENABLED=false`
exists for extra replicas, but rate limits and live events would then be per process.

### A page request

1. The browser requests a page. The global middleware
   [`app/middleware/auth.global.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/app/middleware/auth.global.ts)
   loads the current user through `useMe()` (`GET /api/me`), redirects guests to `/login`, and
   throws a 404 when the page's `definePageMeta({ minLevel })` is above the user's level.
2. The page fetches its data with `useFetch('/api/...')`. During SSR this is an in-process call
   (no network), which matters for the compression plugin below.
3. The API handler checks permissions with `requireUser(event, minLevel)`, validates input with
   `readForm()` and queries MariaDB through Drizzle (`useDb()`).
4. The HTML (and later the JSON of client-side navigation) is compressed by
   `server/plugins/compression.ts`.

## Sign-in, session and permissions

- **Session**: [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils) stores an encrypted
  cookie (`shj-session`, 2 hours, `sameSite: lax`) holding only `{ user: { username } }`. There is
  no session table. `NUXT_SESSION_PASSWORD` is the encryption key.
- **Every request reloads the user** from `shj_users`
  ([`getCurrentUser`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/auth.ts)),
  cached on `event.context` for the rest of that request. A role change or a deleted user takes
  effect on the next request; a username that no longer matches exactly clears the session.
- **Passwords** are bcrypt (`bcryptjs`). Hashes from PHP's `password_hash` (`$2y$`) are accepted by
  rewriting the prefix to `$2b$`, so legacy users keep their passwords.
- **LDAP / RADIUS** (`NUXT_AUTH_METHOD`): tried only after the local password fails
  ([`server/utils/external-auth.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/external-auth.ts)).
  The RADIUS client sends Message-Authenticator and verifies the answer's signature.
- **Rate limits** ([`server/utils/rate-limit.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/rate-limit.ts)):
  in-memory sliding windows. Failed sign-ins: 8 per address and account, 30 per address, 50 per
  account in 15 minutes, then HTTP 429 with `Retry-After`. Password reset and registration have
  their own limits. `clientIp()` trusts `X-Forwarded-For` only when `NUXT_TRUST_PROXY=true`.

Permission levels come from the `role` column
([`shared/roles.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/shared/roles.ts)):

| Level | Role | Typical access |
|---|---|---|
| 0 | `student` | Own submissions, submit, scoreboard (if enabled), Hall of Fame |
| 1 | `instructor` | Everyone's submissions, results and judge logs, submission zip downloads, assignment PDFs at any time |
| 2 | `head_instructor` | Assignments and problems, notifications, rejudge, queue, recordings, cheat detection and Moss |
| 3 | `admin` | Users, settings, backups, 24-hour login log |

`requireUser(event, n)` answers **401** when not signed in and **404** (not 403) when the level is
too low, like the legacy app: staff endpoints do not reveal that they exist. The sidebar in
`app/layouts/default.vue` hides the tools by level; that is only cosmetic, the API check is what
protects data.

### Selected assignment

Like the legacy app, each user has a *selected assignment* (`shj_users.selected_assignment`), set
with `POST /api/assignments/select`. Most pages and endpoints (submit, submissions, scoreboard,
rejudge) work on `user.selectedAssignment` rather than taking an assignment id. When none is
selected, `NO_ASSIGNMENT` (id 0) is used.

## Settings

Admin settings live in `shj_settings` as key/value rows (no unique key on the column, a legacy
detail). Read them with `getSetting(key)` / `getAllSettings()` and write them with `setSetting` /
`setSettings` ([`server/utils/settings.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/settings.ts)).
Settings are read from the database on every use; there is no cache, so a change applies
immediately. `setSetting` only updates an existing row, which is why new keys must be inserted by
the start-up migration. The full list is in [Database](./database#settings).

Environment variables (`runtimeConfig`) are for things that differ per deployment or are secret:
database, session key, mail, LDAP/RADIUS, judge mode, JPlag paths. Everything an admin should
change at run time is a setting.

## Time

All datetimes are stored as **wall-clock strings** (`YYYY-MM-DD HH:MM:SS`) in the time zone from
the `timezone` setting, the same as the legacy app. `mysql2` runs with `dateStrings: true` so they
are never converted. [`server/utils/time.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/time.ts)
compares them by treating every string as if it were UTC:

- `nowStr()`: current wall-clock time in the judge time zone.
- `toEpoch(str)` / `fromEpoch(sec)`: convert for arithmetic (deadlines, delays).
- On the client, `useMe()` stores the offset between server wall clock and browser clock;
  `formatDateTime()` and `useServerNow()` show times without any time-zone conversion.

Never use `new Date()` for anything that is stored or compared with stored values.

## The judge queue

The flow of one submission:

1. `POST /api/submit` (file upload) or `POST /api/submit/editor` (editor) checks the assignment
   window, participants, language and file name (`submitCheck`), stores the file in
   `<assignments_root>/assignment_<a>/p<p>/<username>/<name>-<submitId>.<ext>`, computes the late
   coefficient **at submit time**, and inserts a `PENDING` row in `shj_submissions` plus a row in
   `shj_queue` in one transaction. Upload-only problems skip the queue: their row is final at once
   with status `Uploaded`.
2. `queueKick()` starts the loop unless it is already running. The loop sets the setting
   `queue_is_working` to `1` and processes `shj_queue` in `id` order, **one item at a time**.
3. For each item, `judgeItem()` builds the positional arguments for `tester.sh` (see
   [Judge engine](./judge-engine#arguments)) and runs it locally or hands it to the judge
   container through a job file.
4. The single output line becomes the result: a number means `status = 'SCORE'` and
   `pre_score = number` (0–10000); anything else is stored as the status (`Compilation Error`,
   `Judge Error`, …). `result.html` and `log` are renamed to `result-<id>.html` and `log-<id>`.
5. For a normal judge, the new submission becomes the final one (`is_final = 1`, the previous final
   is cleared). Rejudges keep the final flag.
6. The queue row is removed and a live event is published: `judged` to the student and to
   instructors, `queue` (new length) to head instructors and admins.

**Pause** (`POST /api/queue/pause`) sets `queue_is_working = 0`; the loop finishes the current
item and stops. **Resume** calls `queueKick()` again. At start-up
`server/plugins/queue.ts` resets the flag and kicks the queue, so items left over by a crash or
restart are judged. Rejudge (`/api/rejudge`) resets the rows to `PENDING` with `pre_score = 0` and
queues them with type `rejudge` (upload-only problems are skipped).

Why a loop in the web process: the PHP app started `php index.php queueprocess run &` through a
shell. Running the loop in Nitro removes the shell, and `tester.sh` is spawned with an argument
array, so no input is ever interpreted by a shell (MIGRATION.md).

### Why a separate judge container

Until October 2026 `tester.sh` ran inside the web process. Submitted programs could read the
environment (database password, session key) and every file the web user could read. The judge
container fixes that ([Judge engine](./judge-engine#isolation)): it has no network, gets no
secrets, and compiles and runs every program as `shjrun`, which can only touch its own jail. The
web app and the judge share only the `/data` volume and communicate through files in `/data/jobs`.
EasySandbox, the legacy C sandbox, does not work on current glibc and was never built in the
legacy installation either; the container replaces it.

## Live updates (server-sent events)

Judging results, queue changes, cheat detection progress and new notifications are pushed to the
browser:

- [`server/utils/live.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/live.ts):
  an in-process `EventEmitter`. `livePublish(event, audience)` never waits for subscribers.
  The audience is a username, a minimum level, both, or everyone.
- [`server/api/events.get.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/api/events.get.ts):
  one `text/event-stream` per tab, filtered per user with `liveVisibleTo`, with a `ping` every 25 s
  and a `ready` event once the stream is open.
- [`shared/live.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/shared/live.ts): the event
  types `judged`, `executed`, `queue`, `cheat`, `notification`.
- [`app/plugins/live.client.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/app/plugins/live.client.ts)
  opens one `EventSource` while signed in, shows toasts, and forwards events to components that
  subscribed with `useLive().on(type, fn)`.

Polling is kept as a fallback: pages such as `SubmissionsView.vue` and `queue.vue` poll every 3 s
only while `useLive().connected` is false.

| Event | Published by | Audience |
|---|---|---|
| `judged` | `judgeItem` | the submitter, and level ≥ 1 |
| `executed` | `judgeItem` (editor run) | the submitter only |
| `queue` | `queueAddSubmission`, `removeItem` | level ≥ 2 |
| `cheat` | `cheatKick` | level ≥ 2 |
| `notification` | `POST /api/notifications` | everyone signed in |

## Cheat detection

Details for users are in [Cheat detection](../guide/cheat-detection). For developers:

- `POST /api/cheat/<assignment>/run` calls `cheatQueueRuns()`, which inserts one `cheat_runs` row
  (`status = 'queued'`) per problem and language that has at least two final submissions to
  compare, then `cheatKick()`.
- `cheatKick()` processes queued runs **one at a time** in the web process. For each run it copies
  the final submissions into `<NUXT_CHEAT_WORK_DIR>/run-<id>/` (`new/` and, for older assignments,
  `old/`), adds the problem's template code (`p<p>/basecode/template.<ext>`) if present, and runs
  `java -jar jplag.jar` with `execFile` (no shell, 15-minute timeout).
- If no minimum token count was given, it lowers JPlag's minimum match length for short programs
  (median tokens ÷ 6, at least 4) and runs again.
- The report is parsed into `cheat_pairs`, the `.jplag` file is kept as
  `reports/run-<id>.jplag`, and older runs of the same problem and language are deleted.
- JPlag needs Java 25; the tester stays on Java 17 because `tester.sh` uses the Java Security
  Manager, which was removed in Java 24. That is why the image carries two Java runtimes. The Java
  25 one is made with `jlink` and must include `jdk.compiler`: JPlag's Java parser uses it, and
  without it every Java submission is reported as not parsable.
- Runs interrupted by a restart are marked `failed` by `server/plugins/migrate.ts`.

Moss (the legacy option) still works through `server/utils/moss.ts`, which runs the Perl client
`tester/moss_original` with a filled-in user id. It needs network access, so it runs in the web
container.

## Backups

The `backup` service runs [`docker/backup/backup.sh`](https://github.com/ayenz/Sharif-Judge/blob/main/docker/backup/backup.sh):
once a day it writes `database.sql.gz` (mariadb-dump), `files.tar.gz` (`/data/assignments`) and
`SHA256SUMS` into `BACKUP_DIR/<YYYY-MM-DD_HHMM>/`, and deletes folders older than the retention.

The web app never runs the backup itself. It mounts the folder read-only and talks to the script
through files ([`server/utils/backups.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/backups.ts)):

| File | Written by | Meaning |
|---|---|---|
| `state.json` | backup.sh, every 10 s | schedule, next run, `heartbeat` |
| `latest.json` | backup.sh | last run: `ok`, `failed` or `running` |
| `control/run-now` | web (Settings › Backups) | "back up now" request; the script deletes it |
| `control/config.json` | web | `{ time, keepDays }`, overrides `BACKUP_TIME` / `BACKUP_KEEP_DAYS` |

The service counts as running when the heartbeat is less than two minutes old. The admin dashboard
shows a warning when it is not running, no backup exists, the last one failed or is older than two
days. Without `NUXT_BACKUP_DIR` (e.g. `npm run dev`) the backup UI reports "not configured".

## Compression

The app is often reached directly, without a reverse proxy, so it compresses its own responses:

- Static assets are precompressed at build time (`nitro.compressPublicAssets`, Brotli and gzip).
- [`server/plugins/compression.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/plugins/compression.ts)
  compresses HTML and JSON bodies of at least 1 KB in a `beforeResponse` hook (Brotli quality 5,
  else gzip). Streams (SSE, downloads) and buffers are left alone.
- It skips **internal requests**: `/__nuxt*` paths (error page rendering) and requests without a
  socket address (SSR calling the API in-process). Those callers read the body as text, so
  compressing them corrupted the final response.

A first visit went from about 1–1.4 MB to 250–320 KB.

## Start-up tasks

Two Nitro plugins run shortly after the server starts (both skip prerendering):

- [`server/plugins/migrate.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/plugins/migrate.ts)
  (after 0.5 s): `migrateExtraTables()` creates the tables added after the legacy schema and inserts
  missing new settings; `migrateLegacyPaths()` switches `tester_path` / `assignments_root` to the
  configured folders when the stored ones (e.g. a PHP install's `/var/www/html/restricted/tester`)
  do not exist here; interrupted cheat runs are marked failed. Nothing happens before `/install`
  has created `shj_settings`.
- [`server/plugins/queue.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/plugins/queue.ts)
  (after 2 s, only with the queue enabled): resets `queue_is_working` and kicks the queue.

This is how an installation upgrades itself: pull, rebuild, restart. There is no separate migration
command.

## Code layout of `web/`

```
app/                 client and SSR
  pages/             file-based routes; definePageMeta({ minLevel })
  components/        AppPage (page shell), Submit*, Submission*, Cheat*, Recording*, Settings*
  composables/       useMe, useApiForm, useLive, useThemeSwitch
  layouts/           default (sidebar), auth (login pages)
  middleware/        auth.global.ts
  plugins/           live.client.ts
  utils/             api<T>(), format helpers, Ace loader, editor recorder
server/
  api/               JSON endpoints, one file per route and method
  utils/             auto-imported helpers (db, auth, settings, time, queue, cheat, ...)
  database/          schema.ts (Drizzle), install.ts (fresh-install DDL), migrate.ts
  plugins/           compression, migrate, queue
shared/              code for both sides, imported as #shared/...: roles, languages, cheat, live
```
