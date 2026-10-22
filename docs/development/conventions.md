# Conventions

These are the rules the code follows. The short version lives in
[`web/CONVENTIONS.md`](https://github.com/ayenz/Sharif-Judge/blob/main/web/CONVENTIONS.md); this page
explains them and adds the git conventions and the mistakes that already cost time.

## The legacy app is the specification

The Nuxt app is a port, not a redesign. When you change behaviour that existed in the PHP app, keep
the same permission checks, validation limits, user-visible error messages and computations. Improve
the interface, not the semantics.

The PHP code is no longer in `main`. Read it from the tag `archive/php-final`:

```bash
git show archive/php-final:application/controllers/Submit.php
git show archive/php-final:application/models/Assignment_model.php
git show archive/php-final:restricted/tester/tester.sh
```

Many functions name their legacy counterpart in a comment (for example "legacy
`Assignments::_add`"), so you can find the original quickly.

When the legacy behaviour is clearly a bug or a security hole (SQL injection, path traversal, shell
injection), fix it and leave a short comment that says how it differs. Every intentional difference
is listed in [`MIGRATION.md`](https://github.com/ayenz/Sharif-Judge/blob/main/MIGRATION.md)
("Perbedaan perilaku yang disengaja"); add yours there too.

## Server (`web/server/`)

### Endpoints

- One file per route and method, using Nitro names: `server/api/<module>/index.get.ts`,
  `[id].post.ts`, `[id]/submissions.delete.ts`.
- Start every handler with the permission check:

  ```ts
  const user = await requireUser(event, 2) // 0 student, 1 instructor, 2 head instructor, 3 admin
  ```

  Below the level the API answers 404, like the legacy app.
- Read input with `readForm(event, z.object({ ... }))` from
  [`server/utils/validation.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/validation.ts)
  and reuse the shared `rules` (`username`, `password`, `email`, `id`). Invalid input becomes
  HTTP 422 with `{ errors: { field: message } }`; throw `validationError({ field: 'message' })` for
  your own checks. Route parameters: `intParam(event, 'id')` (404 if not an integer).
- Other errors: `throw createError({ statusCode, statusMessage })`. The message is shown to the user,
  so write it as a sentence.

### Database, settings, time

- Drizzle through `useDb()` and `schema` (both auto-imported). Raw SQL only through
  `usePool().query(sql, params)` with `?` placeholders. **Never** build SQL from user input by
  concatenation.
- Settings: `getSetting(key)`, `getAllSettings()`, `setSettings({ ... })`.
- Time: `nowStr()`, `nowEpoch()`, `toEpoch(str)`, `fromEpoch(sec)`. Database datetimes are
  wall-clock strings in the judge time zone; never store `new Date()`.
- Scores: `computeScores(preScoreRaw, problemScore, coefficient)`. Late rules:
  `evalLateRule(rule, delay, extraTime)`.
- New tables and settings: see [Database](./database#adding-a-table). Never change legacy tables.

### Files and processes

- Never pass user input to a shell. Use `node:fs/promises`, and `spawn` / `execFile` with an
  argument array for processes.
- Validate every path segment that comes from input: usernames `^[a-z0-9]+$`, ids are integers,
  file names `^[A-Za-z0-9_\-()]+$`. Build paths with the helpers `assignmentDir()`,
  `problemDir()`, `userDir()` (which re-checks the username).

### Utilities and auto-imports

- Helpers other modules may use go in `server/utils/<module>.ts`. Everything exported there is
  auto-imported on the whole server, so prefix names with the module: `assignmentDir`,
  `queueKick`, `cheatQueueRuns`, `backupStatus`.
- Prefer functions, and at most one exported constant object per file (`EDITOR` in `queue.ts`). See
  [the pitfall](#auto-import-scanner-skipped-a-second-export-const) below.
- Types used by both the API and the pages go in `shared/` and are imported with `#shared/...`.

### Long jobs

Judging and cheat detection run in the background inside the server process, one at a time, with
their state in the database (`shj_queue`, `cheat_runs`). The API only queues work and returns; the
page learns about progress from live events, with polling as the fallback. Follow the same pattern
for any new long job, and make it resume or fail cleanly after a restart (see
`server/plugins/migrate.ts` and `server/plugins/queue.ts`).

## Client (`web/app/`)

- **Page shell**: every page uses `<AppPage title icon>`. Put page actions in a header row inside
  the page.
- **Permissions**: `definePageMeta({ minLevel: 2 })` on the page, `useMe().level` to hide controls.
  Hiding is cosmetic; the API check is what protects data.
- **Data**: `useFetch('/api/...')` for page data; mutations with `$fetch` and `useToast()`.
- **Forms**: `UForm` with `useApiForm(url, state, { onSuccess })`, which maps the server's 422
  field errors onto the form fields.
- **Components**: Nuxt UI 4 (`UTable`, `UCard`, `UButton`, `UModal`, `UBadge`, `UTabs`,
  `UFileUpload`, `UEditor`, …) and Lucide icons (`i-lucide-*`). No other UI libraries. Heavy widgets
  (Ace, the rich-text editor) load only on the pages that need them, via `defineAsyncComponent` or
  `<LazyX>`.
- **Times**: API times are wall-clock strings. Show them with `formatDateTime()`; durations with
  `hhmm()` / `humanDuration()`. For a ticking clock use `useServerNow()`.
- **Live updates**: `useLive().on('judged', fn)` to refresh on an event; keep a polling fallback
  that only runs while `useLive().connected` is false.
- **Responsive**: every page must work at phone width (390 px): tables scroll horizontally, forms
  stack. `tests/e2e/browser.py` fails on horizontal page scroll.
- **Colours**: semantic Nuxt UI tokens (`primary`, `neutral`, `text-muted`, `bg-elevated`, …). The
  primary colour is the pastel `ifblue` scale in `app/assets/css/main.css`. No hard-coded colours
  except the logo (and the judge result classes).
- **Motion**: short CSS transitions (≤ 0.3 s); everything must work with reduced motion.

## Checks before committing

```bash
cd web && npm run typecheck
```

Fix every error in the files you touched. Then run the tests that cover the change (see
[Testing](./testing#what-to-run-for-a-change)).

## Code style

[`.editorconfig`](https://github.com/ayenz/Sharif-Judge/blob/main/.editorconfig) sets UTF-8, LF,
2-space indentation and a final newline. `tester/**` uses tabs. The TypeScript style follows the
existing code: no semicolons, single quotes, trailing commas in multi-line literals,
`if (...)` without braces for one-line bodies.

## Git

- **Branch**: work happens on `main`. There is no long-lived development branch.
- **Small commits**, each one complete: code, tests and documentation for one change together
  (e.g. "Add daily backups", "Fix scrolling tab bars").
- **Messages**: a short subject in the imperative, without a prefix, then a body that explains
  *why* and what the user notices, wrapped at about 72 characters. Example from the history:

  ```
  Fix scrolling tab bars

  overflow-x: auto also enables vertical overflow, so the active-tab indicator
  showed a vertical scrollbar on Settings and Cheat Detection, and on phones
  the tab labels were squeezed to a few letters. Tab lists now scroll only
  sideways, keep full labels and keep the indicator visible.
  ```

- **Archive tags**: old lines of development are kept as tags under `archive/`, not as branches.
  `archive/php-final` is the last PHP version (used by the regression test); others hold earlier
  branches (`archive/Version-1`, `archive/docs-php`, …). Do not delete or move them.
- **Release tags** from the PHP era follow `v1.4`, `v1.5.2-unpar`.
- **Never commit** `docker/.env`, `web/.env`, `docker/backups/` or an `assignments/` folder; they
  are in `.gitignore`.

## Pitfalls we hit

### Empty table headers break hydration

A `UTable` column with `header: ''` renders differently on the server and in the browser, which
causes a hydration mismatch. Give every column a header; for columns without a visible title use
screen-reader text:

```ts
const srOnly = (label: string) => () => h('span', { class: 'sr-only' }, label)
const columns: TableColumn<Row>[] = [{ id: 'select', header: srOnly('Select') }, /* ... */]
```

`tests/e2e/browser.py` reports hydration errors as console errors.

### Auto-import scanner skipped a second `export const`

The scanner that makes `server/utils/*` auto-importable has, at least once, skipped the second
`export const` in a file, so that constant was not available elsewhere. Prefer exported functions
and at most one exported constant object per file, grouping related constants
(`export const EDITOR = { file: 'editor', … } as const` in `queue.ts`). If an auto-import seems to
be missing, check whether it is a second `export const` before looking further.

### `overflow-x: auto` on tab lists

Setting `overflow-x: auto` makes `overflow-y` compute to `auto` as well (CSS rule), so the
active-tab indicator produced a vertical scrollbar, and on phones the labels were squeezed. Use the
`tabs-scroll` class from `main.css` on the tab list (`:ui="{ list: 'tabs-scroll' }"`), which scrolls
sideways only, hides the scrollbar, keeps full labels and keeps the indicator visible.

### Server-sent events: pushing before `send()` hangs

In `server/api/events.get.ts`, a `stream.push()` before `return stream.send()` waits for a reader
that does not exist yet, and the request never starts streaming. Send the first event from a
`setTimeout(…, 0)` after setting up the stream, as the `ready` event does. Never `await` a push in
a publisher: `livePublish` must not wait for slow clients.

### Do not compress internal requests

`server/plugins/compression.ts` must skip `/__nuxt*` paths (error page rendering) and requests
without a socket address (SSR calling the API in-process). Those callers read the body as text;
compressing them corrupted the final page. If you add another response hook, keep these exclusions,
and never compress streams.

### `$fetch` with deep route types

Nuxt infers response types for `$fetch('/api/...')` from the route files. On some calls this makes
TypeScript fail with an "excessive stack depth" error. Use the
helper from `app/utils/api.ts` and annotate the type yourself:

```ts
const res = await api<{ ok: boolean }>('/api/queue/pause', { method: 'POST' })
```

### `setSetting` does not insert

`setSetting(key, value)` is an `UPDATE`. A setting that has no row (for example a new key on an old
installation) is silently not saved. Add new keys to `EXTRA_SETTINGS` in `migrate.ts`.

### Multi-word `diff_arg`

The tester's arguments are positional and a `diff_arg` with spaces becomes several arguments,
shifting all later ones. This is legacy behaviour kept on purpose; see
[Judge engine](./judge-engine#arguments).

### Files shared between web and judge

Anything the web app writes that the judge must read has to live in a shared volume: `/data`
(assignments, jobs) and `shields` (`/app/tester/shield`). The rest of `/app/tester` is a separate copy
in each container. Shield edits once went only to the web container's copy and never reached the
judge; see [Judge engine](./judge-engine#shields-easysandbox-and-the-java-policy).

### One process only

The queue loop, the rate-limit counters and the live event bus live in memory. Running two web
processes with the queue enabled would judge items twice; with the queue disabled on the second one,
rate limits and live events still only see their own process. Keep one web process.
