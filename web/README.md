# SharIF Judge web app

Nuxt 4 application: server-rendered pages (Vue + [Nuxt UI](https://ui.nuxt.com)), the JSON API,
the judge queue worker and cheat detection, in one Node.js process.

## Getting started

```bash
cp .env.example .env    # database, session secret, paths
npm install
npm run dev             # http://localhost:3000
```

You need a MySQL/MariaDB database. For judging and cheat detection on a development machine, point
`NUXT_PATHS_TESTER` at `../tester` (Linux with the compilers installed) or set
`NUXT_QUEUE_ENABLED=false` and use the Docker setup for judging.

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
  plugins/                start-up: create new tables, resume the judge queue
shared/                   code used on both sides: roles, languages, cheat detection types
public/                   favicon and static files
```

### Key pieces

- **Database**: Drizzle ORM over `mysql2` (`server/database/schema.ts`), same tables as the legacy
  app. Datetimes are wall-clock strings in the judge time zone; use the helpers in
  `server/utils/time.ts`.
- **Auth**: encrypted cookie session (`nuxt-auth-utils`) holding the username; the user row is
  loaded on every request (`requireUser(event, minLevel)`).
- **Judge queue**: `server/utils/queue.ts` processes `shj_queue` in the background and runs
  `tester/tester.sh` with an argument list (no shell).
- **Late rules**: legacy PHP snippets, translated and run in `node:vm` (`server/utils/late-rule.ts`).
- **Editor recording**: `app/utils/editor-recorder.ts` produces the same JSON as the legacy editor,
  so old recordings replay in `RecordingPlayer.vue`.
- **Cheat detection**: `server/utils/cheat.ts` runs JPlag and computes the review scores; see
  [../docs/cheat-detection.md](../docs/cheat-detection.md).
- **New tables**: add them to `server/database/schema.ts` and `server/database/migrate.ts`
  (`CREATE TABLE IF NOT EXISTS`, run on start-up and on install).

Coding conventions are in [CONVENTIONS.md](CONVENTIONS.md).
