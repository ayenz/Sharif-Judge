# Code conventions (web/)

The legacy PHP app is the specification for anything ported from it (its code is in the git tag
`archive/php-final`, e.g. `git show archive/php-final:application/controllers/Submit.php`). Keep behavior faithful:
same permission checks, same validation limits, same error messages where users see them,
same computations. Improve UX, not semantics. When legacy behavior is clearly a bug or a
security hole (SQL injection, path traversal, shell injection), fix it and leave a short
comment explaining the difference.

## Server (`server/`)
- Endpoints live in `server/api/<module>/...` using Nitro file naming (`index.get.ts`, `[id].post.ts`).
- Auth: `const user = await requireUser(event, minLevel)` (levels: 0 student, 1 instructor,
  2 head instructor, 3 admin). Below the level → 404, like the legacy app.
- Input: `await readForm(event, z.object({...}))` from `server/utils/validation.ts`; use the
  shared `rules`. Field errors go back as 422 `{ errors: { field: message } }`
  (`throw validationError({...})`). Route params: `intParam(event, 'id')`.
- Database: Drizzle via `useDb()` and `schema` (auto-imported). Never build SQL by string
  concatenation with user input. Raw SQL only through `usePool().query(sql, params)`.
- Settings: `getSetting(key)`, `setSettings({...})`. Time: `nowStr()`, `nowEpoch()`,
  `toEpoch(str)`, `fromEpoch(sec)` — DB datetimes are wall-clock strings in the judge timezone.
- Scores: `computeScores(preScoreRaw, problemScore, coefficient)`; late rules:
  `evalLateRule(rule, delay, extraTime)`.
- Files: never pass user input to a shell. Use `node:fs/promises` and, for processes,
  `spawn`/`execFile` with an argument array. Validate any path segment that comes from input
  (usernames `^[a-z0-9]+$`, ids are integers, file names `^[A-Za-z0-9_\-()]+$`).
- Utilities you add that other modules may use go in `server/utils/<module>.ts`. Exported names
  are auto-imported globally, so prefix them with the module (e.g. `assignmentDir`, `queueKick`).
  Prefer one exported constant object per file (`EDITOR`): the scanner has skipped a second
  `export const` in the same file before.
- New tables: add them to `server/database/schema.ts` and to `server/database/migrate.ts`
  (`CREATE TABLE IF NOT EXISTS`, run on start-up and on install). Never change legacy tables.
- Long jobs (judging, cheat detection) run in the background inside the server process, one at a
  time, with their state in the database; the API only queues them and the page polls.
- Types used by both the API and the pages go in `shared/` (import with `#shared/...`).

## Client (`app/`)
- Every page uses `<AppPage title icon>`; put page actions in a header row inside the page.
- One content width for all pages; `wide` only for code side by side or replay. Tables: `class="data-table"` (plain) or `UTable` (themed in `app.config.ts`); no per-page header or padding styles; last column "Actions", right-aligned.
- Permission gating: `definePageMeta({ minLevel: 2 })` and `useMe().level` for hiding controls.
- Data: `useFetch('/api/...')` for page data; mutations with `$fetch` + `useToast()`. If
  TypeScript reports "excessive stack depth" on a `$fetch`, use `api<T>(url, options)` from
  `app/utils/api.ts`.
  Forms: `UForm` + `useApiForm(url, state, { onSuccess })` which maps server field errors.
- UI: Nuxt UI 4 components (`UTable`, `UCard`, `UButton`, `UModal`, `UBadge`, `UTabs`,
  `UFileUpload`, `UEditor`, ...). Lucide icons (`i-lucide-*`). Keep pages light: no extra
  UI libraries; heavy widgets (Ace editor, rich text editor) only on the pages that need them
  via `defineAsyncComponent` / `<LazyX>`.
- Times from the API are wall-clock strings: show them with `formatDateTime()`;
  durations with `hhmm()` / `humanDuration()`.
- Responsive: usable on a phone (tables scroll horizontally, forms stack).
- Colors: use the semantic Nuxt UI tokens (`primary`, `neutral`, `text-muted`, `bg-elevated`, ...);
  the primary is the pastel `ifblue` scale from `assets/css/main.css`. No hard-coded colors except
  the logo.
- Table columns without a visible title still need a header (`sr-only` text): an empty string
  header renders differently on the server and breaks hydration.
- Motion: short (≤ 0.3 s) CSS transitions; everything must still work with reduced motion.

## Checks
Run `npx nuxt typecheck` before finishing; fix every error in files you own.
