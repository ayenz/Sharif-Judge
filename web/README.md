# SharIF Judge web app

Nuxt 4 application: server-rendered pages (Vue + [Nuxt UI](https://ui.nuxt.com)), the JSON API,
the judge queue worker and cheat detection, in one Node.js process.

## Getting started

```bash
cp .env.example .env    # database, session secret, paths
npm install
npm run dev             # http://localhost:3000
```

You need a MySQL/MariaDB database (a local one, or the Docker MariaDB through an SSH tunnel; use
a separate database such as `shj_dev`, not the one a deployed app uses).

Judging: with `NUXT_JUDGE_MODE=local` (the default) the app runs `../tester/tester.sh` itself, which
needs Linux with `gcc`, `g++`, Java and Python, and runs submissions **without** the judge
container's isolation. On macOS or Windows, test judging on the Docker setup instead. The judge
queue only runs in the process that received the submission, so a dev server with
`NUXT_QUEUE_ENABLED=false` leaves submissions `PENDING`. More in the
[development guide](https://ayenz.github.io/Sharif-Judge/development/getting-started).

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `.output/` (`node .output/server/index.mjs`) |
| `npm run typecheck` | TypeScript check of app, server and shared code |

## Structure

```
app/                      client and SSR
  pages/                  one file per route (file-based routing)
  components/             AppPage (page shell), Submit*, Submission*, Cheat*, Recording*, ...
  composables/            useMe (current user), useApiForm, useThemeSwitch
  utils/                  formatting, Ace loader, editor recorder, API helper
  layouts/                default (sidebar), auth (login pages)
  middleware/             auth.global.ts: login redirect and page permission levels
server/
  api/                    JSON endpoints, one file per route and method
  utils/                  auto-imported helpers: db, auth, settings, time, queue, scoreboard, cheat, ...
  database/               Drizzle schema, install DDL, migrations for new tables
  plugins/                start-up migrations, resuming the judge queue, response compression
shared/                   code used on both sides: roles, languages, cheat detection types
public/                   favicon and static files
```

### Key pieces

- **Database**: Drizzle ORM over `mysql2` (`server/database/schema.ts`), same tables as the legacy
  app. Datetimes are wall-clock strings in the judge time zone; use the helpers in
  `server/utils/time.ts`.
- **Auth**: encrypted cookie session (`nuxt-auth-utils`) holding the username; the user row is
  loaded on every request (`requireUser(event, minLevel)`).
- **Judge queue**: `server/utils/queue.ts` processes `shj_queue` in the background. In `remote` mode
  it writes a job file for the isolated judge container (`../judge/worker.mjs`) and waits for the
  result; in `local` mode it runs `tester/tester.sh` itself with an argument list and no secrets in
  the environment.
- **Live updates**: `server/utils/live.ts` (event bus) and `server/api/events.get.ts` (server-sent
  events, filtered per user); `app/plugins/live.client.ts` shows toasts and `useLive()` lets pages
  refresh on events instead of polling.
- **Compression**: static assets are precompressed at build time (`nitro.compressPublicAssets`);
  `server/plugins/compression.ts` compresses HTML and JSON responses.
- **Settings added after the legacy schema** (e.g. `enable_python2`) get their default row from
  `server/database/migrate.ts`.
- **Rate limits**: `server/utils/rate-limit.ts` (in memory) for sign-in, password reset and
  registration; client addresses via `clientIp()`.
- **Late rules**: legacy PHP snippets, translated and run in `node:vm` (`server/utils/late-rule.ts`).
- **Editor recording**: `app/utils/editor-recorder.ts` produces the same JSON as the legacy editor,
  so old recordings replay in `RecordingPlayer.vue`.
- **Cheat detection**: `server/utils/cheat.ts` runs JPlag and computes the review scores; see
  [../docs/guide/cheat-detection.md](../docs/guide/cheat-detection.md).
- **New tables**: add them to `server/database/schema.ts` and `server/database/migrate.ts`
  (`CREATE TABLE IF NOT EXISTS`, run on start-up and on install).

Coding conventions are in [CONVENTIONS.md](CONVENTIONS.md).
