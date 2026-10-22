# Getting started

This page gets the app running on your machine, explains the two ways submissions can be judged
during development, and shows how a change usually travels from your editor to the test server.
Read [Architecture](./architecture) next to see how the pieces fit together.

## What is in the repository

| Folder | What it is |
|---|---|
| [`web/`](https://github.com/ayenz/Sharif-Judge/blob/main/web/README.md) | The Nuxt 4 app: pages, JSON API, judge queue, cheat detection. One Node.js process. |
| [`judge/`](https://github.com/ayenz/Sharif-Judge/blob/main/judge/worker.mjs) | `worker.mjs`, the process that runs in the isolated judge container. |
| [`tester/`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/tester.sh) | The Bash judging engine (`tester.sh`, `runcode.sh`, shields, Java policy). Unchanged from the PHP version except for the isolation hooks. |
| [`docker/`](https://github.com/ayenz/Sharif-Judge/blob/main/docker/README.md) | The image (`web.Dockerfile`), `compose.yml`, the backup script, the MariaDB init script. |
| [`tests/`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/README.md) | Regression test against the legacy PHP app, end-to-end tests, migration and RADIUS tests. |
| `docs/` | This documentation site (VitePress). |

## Prerequisites

- **Node.js 24** (the image uses `node:24-bookworm-slim`) and npm.
- **MySQL or MariaDB.** Production uses MariaDB 10.11 from `docker/compose.yml`.
- **To judge locally** (optional): Linux with `bash`, `gcc`, `g++`, a JDK 17, `python3`, `perl`,
  `procps` and `diffutils`. `tester.sh` uses GNU `date +%N`, `ulimit` and `ps`, so it does not run
  on macOS. On macOS, judge with the Docker setup instead (see below).
- **For cheat detection** (optional): Java 25 and the JPlag 6.3 jar. The image downloads both;
  locally you can leave them unset and the cheat pages will say that JPlag is not installed.
- **For the tests**: [uv](https://docs.astral.sh/uv/), SSH access to the test server, and Docker
  on that server. See [Testing](./testing).

## Run the app

```bash
cd web
cp .env.example .env
npm install          # also runs `nuxt prepare` (postinstall)
npm run dev          # http://localhost:3000
```

Fill in `.env` before starting:

| Variable | What to put there |
|---|---|
| `NUXT_DB_HOST`, `NUXT_DB_PORT`, `NUXT_DB_USER`, `NUXT_DB_PASSWORD`, `NUXT_DB_DATABASE` | Your database. The prefix `NUXT_DB_PREFIX` stays `shj_`. |
| `NUXT_SESSION_PASSWORD` | At least 32 characters, e.g. `openssl rand -hex 24`. Without it sign-in fails. |
| `NUXT_PATHS_TESTER`, `NUXT_PATHS_ASSIGNMENTS` | Written to Settings on a fresh install. The defaults `../tester` and `../assignments` point into the repository; `/assignments/` is git-ignored. |
| `NUXT_QUEUE_ENABLED` | `false` if this machine cannot run `tester.sh` (see below). |
| `NUXT_CHEAT_*`, `NUXT_MAIL_*`, `NUXT_AUTH_*` | Leave empty unless you work on those features. |

Every key in `runtimeConfig` in
[`web/nuxt.config.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/nuxt.config.ts) can be
set with a `NUXT_` variable (`judge.mode` → `NUXT_JUDGE_MODE`, `trustProxy` → `NUXT_TRUST_PROXY`,
`backup.dir` → `NUXT_BACKUP_DIR`). `.env.example` lists only the ones you usually need.

On the first visit the login page sends you to `/install`, which creates the tables, the default
settings and the first admin account
([`server/api/install/index.post.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/api/install/index.post.ts)).

### Database options

**A local MariaDB.** Any MariaDB or MySQL works. Create an empty database (utf8mb4) and a user,
put them in `.env`, and install through `/install`.

**The MariaDB of a Docker setup, through an SSH tunnel.** The `db` service in `docker/compose.yml`
publishes no port; it is only on the Compose network. To use it from your machine, tunnel to the
container's address:

```bash
# On the server: the address of the db container (project name "sharif-judge")
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' sharif-judge-db-1

# On your machine: forward local port 3307 to it
ssh -N -L 3307:<container-ip>:3306 <server>
```

Then set `NUXT_DB_HOST=127.0.0.1`, `NUXT_DB_PORT=3307`, `NUXT_DB_USER=shj` and the `DB_PASSWORD`
from `docker/.env`. The container address changes when the container is recreated.

::: warning Use your own database, not the one the Docker app uses
Give local development its own database on that server, for example:

```bash
docker compose exec db mariadb -uroot -p"$DB_ROOT_PASSWORD" \
  -e "CREATE DATABASE shj_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; GRANT ALL ON shj_dev.* TO 'shj'@'%';"
```

Two apps on one database disturb each other. On start-up each app rewrites the `tester_path` and
`assignments_root` settings when the stored folder does not exist on its machine
([`migrateLegacyPaths`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/database/migrate.ts)),
so your dev server and the container would keep switching them. The regression test also drops
`shj_web` and `shj_ci3` on the test server.
:::

## Judging during development

Where `tester.sh` runs is chosen by `NUXT_JUDGE_MODE`
([`server/utils/queue.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/queue.ts)):

| Mode | What happens | Use it for |
|---|---|---|
| `local` (default) | The web process spawns `bash ./tester.sh …` in the tester folder, with only `PATH`, `LANG` and `HOME` in the environment. Programs run as your user. | Development on Linux. |
| `remote` | The web process writes a job file to `NUXT_JUDGE_JOBS_DIR` (`/data/jobs`) and waits for the judge container's result file. | The Docker setup (`compose.yml` sets it). |

**Local mode on Linux.** Keep `NUXT_QUEUE_ENABLED=true` and `NUXT_PATHS_TESTER=../tester`.
`tester.sh` creates `jail-<random>` folders inside `tester/` while it works, so the folder must
be writable; they are removed after each run. Local mode has no isolation: submitted code can read
anything your user can. Only submit code you trust.

**No compilers (e.g. macOS).** Set `NUXT_QUEUE_ENABLED=false`. Submissions are stored and wait in
the `shj_queue` table; nothing judges them in this process. To see judging, run the Docker setup
(next section) and test there.

::: tip
Remote mode only works where the judge container can see the same `/data` volume. Do not set
`NUXT_JUDGE_MODE=remote` for `npm run dev`: jobs would be written to `/data/jobs` on your machine
and wait 30 minutes for a result that never comes (then the submission becomes `Judge Error`).
:::

## Type check and build

```bash
cd web
npm run typecheck    # nuxt typecheck: app, server and shared code
npm run build        # production build into .output/
node .output/server/index.mjs
```

Run `npm run typecheck` before every commit and fix every error in the files you touched. There is
no unit test suite in `web/`; behaviour is checked by the scripts in `tests/` (see
[Testing](./testing)).

## The Docker setup

The full system (web, judge, database, backups) runs with Compose. This is also what the tests run
against.

```bash
cd docker
printf "SESSION_PASSWORD=%s\nDB_PASSWORD=%s\nDB_ROOT_PASSWORD=%s\n" \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 12)" "$(openssl rand -hex 12)" > .env
docker compose up -d --build db web judge backup   # app on port 8402
docker compose logs -f web judge
```

After changing code, rebuild with the same `up -d --build db web judge backup`. The `web` and
`judge` services share one image (`sharif-judge-web:latest`), so both pick up changes to
`judge/worker.mjs` and `tester/`.

The test server additionally runs the legacy PHP app on port 8401 (Compose profile `legacy`) for
the regression test. [Testing](./testing) describes that setup and its assumptions (for example
the database root password the scripts use).

## How a change is usually made

1. **Read the surrounding code and the rules.** [Conventions](./conventions) lists the patterns
   (auth, validation, settings, time) and the pitfalls that already cost time. If the change
   touches judging, read [Judge engine](./judge-engine); if it touches tables or settings, read
   [Database](./database).
2. **Make the change on `main`** in small steps, with `npm run dev` running. For anything that
   needs judging, use local mode on Linux or test on the Docker setup.
3. **Type check**: `npm run typecheck`.
4. **Deploy to the test server**: copy the working tree to the server and run
   `docker compose up -d --build db web judge backup` in its `docker/` folder.
5. **Run the tests that cover the change.** At minimum `tests/e2e/smoke.py` and
   `tests/e2e/browser.py` (hydration errors and phone layout). For judging, scoring or
   permissions, run the regression test and `security.py` / `isolation.py`; `tests/run-all.sh`
   runs everything. If no test covers the change, add a check (see [Testing](./testing)).
6. **Commit** with a message that says what changed and why (see [Conventions](./conventions)).
   Update `README.md`, `docker/README.md`, `tests/README.md` or these pages when behaviour,
   configuration or commands change.

::: warning
The regression test deletes all data of both apps on the test server. Never point it at a server
with real data.
:::
