# SharIF Judge

SharIF Judge is a free and open source online judge for C, C++, Java, Python, JavaScript and Go
programming courses. Students submit code (by file upload or in the built-in editor), the judge compiles and
runs it against test cases, and instructors get scores, scoreboards, Excel exports and cheat
detection.

The web application is written in [Nuxt](https://nuxt.com) (Vue + Node.js). It replaced the
CodeIgniter 3 / PHP version while keeping the same database schema, the same assignment folder
layout and the same judging engine, so an existing installation can switch over. The last PHP
version is kept as the tag `archive/php-final`. [MIGRATION.md](MIGRATION.md) has the regression
test results and every intentional behavior change.

SharIF Judge is a fork of [Sharif Judge](https://github.com/mjnaderi/Sharif-Judge) by
[@mjnaderi](https://github.com/mjnaderi), continued from 2017 by Stillmen Vallian
([@ayenz](https://github.com/ayenz)) and then by FTIS UNPAR ([@ifunpar](https://github.com/ifunpar),
[SharIF-Judge](https://github.com/ifunpar/SharIF-Judge)).

## Documentation

**https://ayenz.github.io/Sharif-Judge/** — installation, configuration, assignments, judging,
cheat detection, backups, migrating from PHP, security, and a development guide. The sources are in
[`docs/`](docs/) (VitePress); changes to `main` are published automatically.

## Features

- **Roles**: admin, head instructor, instructor, student.
- **Assignments**: multiple problems, start/finish time, extra time with a custom late-penalty rule,
  participant lists, PDF and Markdown/HTML problem descriptions, test cases from a zip file.
- **Judging**: C, C++, Java (single files, zips of sources, JARs), Kotlin, Python 3, JavaScript and
  Go; Python 2 (off by default) and Swift (optional in the image) as well; output comparison with
  `diff` or a custom tester; time, memory and output limits; submission queue with pause, resume and
  rejudge. Submissions run in an isolated container (see [Security notes](#security-notes)).
- **Submitting**: file upload, or a built-in code editor with "Run with custom input". The editor
  records how the code was written; instructors can replay the recording.
- **Results**: final and all submissions, scoreboard, Hall of Fame, Excel exports, zip downloads.
  Results appear live: students get a notice as soon as their submission is judged.
- **Cheat detection**: local [JPlag](https://github.com/jplag/JPlag) analysis per problem and
  language, side-by-side comparison, and a per-student review score that combines code similarity
  with editor signals, plus a history across assignments that shows students who are similar again
  and again. [Moss](https://theory.stanford.edu/~aiken/moss/) is still available.
  See [docs/guide/cheat-detection.md](docs/guide/cheat-detection.md).
- **Accounts**: bulk user creation with optional email, self registration with a code, password
  reset by email, optional LDAP or RADIUS login.
- **Interface**: responsive (works on phones), light and dark mode, notifications, dashboard with
  deadlines and calendar, 24-hour login log. Pages are compressed (about 250–320 KB on a first
  visit, a few KB afterwards).
- **Backups**: a daily database dump and archive of the assignment files, kept for 14 days, with
  status, schedule and "back up now" in Settings.

## Repository layout

```
web/       Nuxt application: pages, API, judge queue, cheat detection
judge/     Worker of the isolated judge container: runs tester.sh for queued submissions
tester/    Judging engine (Bash): compiles and runs a submission against the test cases
docker/    Docker image and Compose files
tests/     Regression test against the legacy PHP app, and end-to-end tests
docs/      Feature documentation
```

## Requirements

The supported way to run SharIF Judge is the Docker image, which contains everything:
Node.js 24 (also runs JavaScript submissions), the compilers (`gcc`, `g++`, Java 17, Python 3,
Go 1.27, Kotlin 2.4, Perl; Swift optional) and, for cheat detection,
Java 25 with JPlag. You need:

- A Linux server with Docker and Docker Compose
- MySQL or MariaDB (the Compose file includes MariaDB 10.11)

Running without Docker is possible: Node.js 24, the tools above on the `PATH`, and the paths in
[Configuration](#configuration) set by hand.

## Installation (Docker)

```bash
git clone https://github.com/ayenz/Sharif-Judge.git
cd Sharif-Judge/docker
printf "SESSION_PASSWORD=%s\nDB_PASSWORD=%s\nDB_ROOT_PASSWORD=%s\n" \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 12)" "$(openssl rand -hex 12)" > .env
docker compose up -d --build db web judge backup
```

Then open `http://<server>:8402`. The first visit opens the installer, which creates the tables,
the default settings and the first admin account. After logging in, review **Settings**.

Put a reverse proxy with HTTPS in front of the app for real use, and set
`NUXT_SESSION_COOKIE_SECURE=true` (cookie only over HTTPS) and `NUXT_TRUST_PROXY=true` (real client
addresses for the login limits).
[docker/README.md](docker/README.md) has more details: services, volumes, and **backups and restoring**.

## Configuration

Environment variables (all optional except the database and the session password):

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_DB_HOST`, `NUXT_DB_PORT` | `localhost`, `3306` | MySQL/MariaDB server |
| `NUXT_DB_USER`, `NUXT_DB_PASSWORD`, `NUXT_DB_DATABASE` | | Database credentials |
| `NUXT_DB_PREFIX` | `shj_` | Table prefix (same as the legacy app) |
| `NUXT_SESSION_PASSWORD` | | Secret for the encrypted session cookie, at least 32 characters |
| `NUXT_SESSION_COOKIE_SECURE` | `false` | Set to `true` behind HTTPS |
| `NUXT_PATHS_TESTER`, `NUXT_PATHS_ASSIGNMENTS` | | Folders written to Settings on a fresh install (set by the image) |
| `NUXT_QUEUE_ENABLED` | `true` | Set to `false` on extra web replicas so only one process judges |
| `NUXT_BACKUP_DIR` | | Backup folder as seen by the app (set by Compose); empty hides Settings > Backups |
| `NUXT_JUDGE_MODE`, `NUXT_JUDGE_JOBS_DIR` | `local`, `/data/jobs` | `remote` hands submissions to the isolated `judge` container (the Compose setup); `local` runs them in the web process (development) |
| `NUXT_TRUST_PROXY` | `false` | Trust `X-Forwarded-For` for client addresses; set to `true` only behind a reverse proxy |
| `NUXT_CHEAT_JAVA`, `NUXT_CHEAT_JPLAG_JAR`, `NUXT_CHEAT_WORK_DIR` | | Java 25 and JPlag for cheat detection (set by the image); empty disables it |
| `NUXT_MAIL_HOST`, `NUXT_MAIL_PORT`, `NUXT_MAIL_SECURE`, `NUXT_MAIL_USER`, `NUXT_MAIL_PASS` | port `465`, secure `true` | SMTP for password reset and new-account mails |
| `NUXT_AUTH_METHOD` | | `ldap` or `radius` to also accept those passwords |
| `NUXT_AUTH_LDAP_URL`, `NUXT_AUTH_LDAP_ACCOUNT_SUFFIX` | | e.g. `ldap://dc.example.edu`, `@example.edu` |
| `NUXT_AUTH_RADIUS_SERVER`, `NUXT_AUTH_RADIUS_SECRET` | | e.g. `10.0.0.5:1812` |

Everything else (time zone, limits, late rule, shields, Python 2, mail templates, registration) is on
the **Settings** page.

The backup service reads `BACKUP_DIR` (default `docker/backups`), `BACKUP_TIME` (default `02:00`),
`BACKUP_KEEP_DAYS` (default `14`) and `TZ` from `docker/.env`.

## Upgrading from the PHP version

The Nuxt app runs on an existing PHP installation's database and assignment files: users,
passwords, submissions, scores and recordings carry over, and the folder settings are adjusted
automatically on start-up. Follow the step-by-step guide, which includes a check list and how to
roll back: **[docs/guide/migration-from-php.md](docs/guide/migration-from-php.md)**. The procedure was tested
end to end against the PHP app (`tests/migration/`).

## Development

```bash
cd web
cp .env.example .env   # point it at a MySQL/MariaDB database
npm install
npm run dev
```

See [web/README.md](web/README.md) for the code structure and [web/CONVENTIONS.md](web/CONVENTIONS.md)
for the coding conventions. Tests are described in [tests/README.md](tests/README.md).

## Security notes

Submitted code runs in a separate **judge container** (`judge/worker.mjs`), not in the web app:

- **No network** (`network_mode: none`), so programs cannot reach the database or the internet.
- **No secrets**: the container gets no database password or session key, and `tester.sh` runs with
  only `PATH`, `LANG` and `HOME`.
- **Unprivileged user**: programs are compiled *and* run as `shjrun` (uid 2000), which owns only its
  jail directory. It cannot read test cases, expected outputs or other students' code; this also
  covers compile-time tricks such as `#include` of an answer file.
- **Limits**: per-test time, memory and output limits from `tester.sh`, plus container limits on
  processes (512), memory (2 GB) and CPUs (2), all capabilities dropped except those needed to
  switch user, and `no-new-privileges`.
- The C/C++ and Python **shields** and the Java **policy** still apply as a second layer.
  `tests/e2e/isolation.py` checks that the isolation holds even with the shields turned off.

Other measures:

- Failed sign-ins are limited: 8 per address and account, 30 per address, 50 per account in
  15 minutes (then HTTP 429). Password-reset mails (5 per hour per address) and registrations are
  limited too.
- EasySandbox is not used: it does not work on current glibc (the legacy installation never built it
  either). The judge container replaces it.
- The Nuxt version fixes several legacy issues (SQL injection, shell command injection, zip-slip,
  path traversal, an expected output left readable between test cases); details are in
  [MIGRATION.md](MIGRATION.md).

## License

SharIF Judge is free software under the GNU General Public License v3; see [LICENSE](LICENSE).
It builds on [Sharif Judge](https://github.com/mjnaderi/Sharif-Judge) by Mohammad Javad Naderi,
the work of Stillmen Vallian ([@ayenz](https://github.com/ayenz)), and the SharIF Judge work of
FTIS UNPAR / [ifunpar](https://github.com/ifunpar/SharIF-Judge).
