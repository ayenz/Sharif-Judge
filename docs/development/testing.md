# Testing

SharIF Judge is tested from the outside: Python scripts drive the deployed apps over HTTP (and a
browser), and compare the results with the legacy PHP app or with expected values. There is no unit
test suite in `web/`; `npm run typecheck` is the only check that runs without a server.

All tests are in [`tests/`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/README.md). They
use [uv](https://docs.astral.sh/uv/), which fetches the Python dependencies (`requests`, `openpyxl`,
`playwright`) on the fly.

## The test server

The scripts expect the Docker setup from `docker/compose.yml` running on a test server. Its
addresses are hard-coded at the top of each script:

| Assumption | Value in the scripts | Used by |
|---|---|---|
| Nuxt app | `http://172.30.30.101:8402` | all tests |
| Legacy PHP app | `http://172.30.30.101:8401` (Compose profile `legacy`) | regression, migration |
| Migrated Nuxt instance | `http://172.30.30.101:8403` | migration |
| SSH host | `stillmen.dell` | regression, `python2.py`, `run-all.sh` |
| Compose folder on the server | `~/stillmen/sharif-judge/repo/docker` | regression, `python2.py`, `run-all.sh` |
| Legacy code on the server | `~/stillmen/sharif-judge/ci3` (`CI3_SRC`) | regression |
| MariaDB root password | `shj_root` (the Compose default when `DB_ROOT_PASSWORD` is not set) | regression, `python2.py`, `run-all.sh` |
| Databases | `shj_web` (Nuxt), `shj_ci3` (PHP), `shj_migrated` | regression, migration |
| Time zone | `Asia/Jakarta` | regression |

If you use a different server, change those constants. The scripts run commands on the server with
`ssh <host> "cd <compose dir> && docker compose exec -T db mariadb -uroot -pshj_root …"`, so you
need key-based SSH access and Docker rights there.

::: danger The regression test deletes everything
`tests/regression/run.py` drops and recreates `shj_web` and `shj_ci3`, deletes all assignment
folders of both apps and restarts `web`. Only run it against a dedicated test server.
:::

### Setting up the legacy app

The PHP app is no longer in `main`. Its last version is the tag `archive/php-final`, and its image
is in `tests/regression/legacy/`. On the test server:

```bash
cd docker
git archive archive/php-final | tar -x -C ../ci3        # CI3_SRC, default ../ci3
mkdir -p ../ci3/restricted/assignments
docker compose --profile legacy up -d ci3
```

## Order and fixtures

**Run the regression test first.** It installs both apps and creates the data every other test
uses:

- admin `admin` / `admin123`
- students `alice`, `bob`, `carol`, `dave`, `erin`, `frank`, password `secret123`
- two assignments, *Regression Open* (id 1, open now) and *Regression Late* (finished three hours
  ago, so submissions get a late coefficient), each with the problems *Sum* (C, C++, Java,
  Python 3), *Reverse* (C, Python 3) and *Essay* (upload-only TXT/PDF)
- 19 submissions from those students

The end-to-end tests select assignment 1 and use these users. Several of them submit code and wait
for the queue to drain, so they take minutes, not seconds.

## The suites

| Script | Command | What it proves |
|---|---|---|
| Regression | `uv run tests/regression/run.py` | Old and new app give **identical** statuses, scores, late coefficients, final flags, scoreboard order, Hall of Fame and Excel exports for 19 submissions (C, C++, Java, Python 3, upload; correct, wrong, partial, compile/syntax error, time limit, runtime error, late). |
| Pages | `uv run --with requests python tests/e2e/smoke.py` | Every page renders without a Nuxt error for an admin and a student; staff pages answer 404 to a student. |
| Security | `uv run --with requests python tests/e2e/security.py` | No access to other students' code, path traversal refused, staff endpoints closed, no re-install, SQL-like input harmless, server secrets hidden from submitted code, sign-in rate limit (also with a forged `X-Forwarded-For`). |
| Isolation | `uv run --with requests python tests/e2e/isolation.py` | C, Python and Java submissions try to read expected outputs and other students' code, `#include` an answer at compile time, reach the database and read `NUXT_*` variables. Every probe must print `blocked`. |
| Editor | `uv run --with requests python tests/e2e/editor-flow.py` | Save, run with custom input, submit, recording, rejudge. |
| Live updates | `uv run --with requests python tests/e2e/live.py` | Server-sent events: a student receives only their own results; staff receive everyone's and the queue events. |
| JavaScript and Go | `uv run --with requests python tests/e2e/languages.py` | 18 programs from `tests/e2e/languages/` get the expected result: accepted, wrong, syntax or compile error, time limit, runtime error, memory limit (a growing program and a 200 MB burst that ends before the 50 ms sampling sees it), a program that fits the limit, and a Go package outside the image's build cache. Then "Run" in the editor, and isolation probes (answers, other students' code, database, secrets, a shell from Node) from both languages. |
| Export and import | `uv run --with requests --with playwright python tests/e2e/export-import.py` | The export zip has `assignment.json` matching the edit form. Importing it on the add page in Chromium fills the form (start and finish empty), and the saved copy has the same problems and byte-identical tests and descriptions, with participants `ALL` and open/archived off. A zip without `assignment.json` shows a message. The export also works as a plain tests upload, and `assignment.json` is never stored in the assignment folder. |
| Python 2 | `uv run --with requests python tests/e2e/python2.py` | Python 2 is off by default, hidden and refused; can be switched on and off; an installation without the `enable_python2` row gets it (value 0) after a restart. |
| Cheat detection | `uv run --with requests python tests/e2e/cheat-flow.py` | Renamed, reordered, C, JavaScript and Go copies are found, an independent solution is not; paste signals, template code, comparison with older assignments, access rules, history across assignments. |
| Browser | `uv run --with requests --with playwright python tests/e2e/browser.py` | Every page in Chromium: no console or page errors (this catches hydration mismatches), no horizontal page scroll at 390 px for a student, the Ace editor renders on the submit page. Screenshots go to `/tmp/sharif-shots/`. |

The browser test needs Chromium once:
`uv run --with playwright python -m playwright install chromium`.

### Regression test

[`tests/regression/run.py`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/regression/run.py)
is the most important test: it is what lets us say that the rewrite judges exactly like the PHP
app. It drives the legacy app through its HTML forms (with CSRF tokens) and the Nuxt app through its
JSON API, runs the same scenario on both in parallel, waits for each queue to drain after every
submission, and compares the results. Submissions come from
[`tests/regression/corpus/`](https://github.com/ayenz/Sharif-Judge/tree/main/tests/regression/corpus),
named `p<problem>_<language>_<case>`.

Options: `--only web` or `--only legacy` runs one side (expectations are still checked);
`--no-reset` keeps the existing data.

### Isolation with the shields off

The container isolation must hold on its own, without the C shield, Python shield and Java policy.
Run `isolation.py` a second time with them disabled. `run-all.sh` does this by setting
`enable_c_shield`, `enable_py3_shield` and `enable_java_policy` to 0 in `shj_settings` and back to 1
afterwards.

### Migration test

[`tests/migration/`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/migration/README.md)
checks the [migration guide](../guide/migration-from-php). After the regression test, the PHP app's
database and folder are copied by following the guide into `shj_migrated`, and a second Nuxt
instance (`web-mig` and `judge-mig` in a Compose override) runs on port 8403. Then:

```bash
uv run tests/migration/verify.py
```

It checks old passwords, the start-up migration (folder paths, new settings and tables), identical
submissions, scoreboards, Excel exports and Hall of Fame against the PHP app, that every old
submission's code and result open, that rejudging every problem gives the same results, and that a
new submission is judged. The setup is manual; follow the README.

### RADIUS test

[`tests/radius/README.md`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/radius/README.md)
is a manual test of `NUXT_AUTH_METHOD=radius` against FreeRADIUS 3.2 and against a forged server
(`fake.js`) that answers Access-Accept without knowing the secret. Expected: the RADIUS password
and the local password sign in; a wrong password, a wrong shared secret, a stopped server and the
forged server all give 401, with the reason in the web log.

## Running everything

[`tests/run-all.sh`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/run-all.sh) runs the
regression test, all end-to-end tests and isolation with shields on and off, then prints a PASS/FAIL
summary with durations and exits non-zero if anything failed:

```bash
tests/run-all.sh                 # SSH_HOST defaults to stillmen.dell
SSH_HOST=other-host tests/run-all.sh
```

It does not run the migration or RADIUS tests. `SSH_HOST` only affects the shield toggling in
`run-all.sh`; the other scripts keep their own constants.

## What to run for a change

| You changed | Run at least |
|---|---|
| A page or component | `smoke.py`, `browser.py` |
| An API endpoint or permission check | `smoke.py`, `security.py` |
| Judging, queue, scores, late rule, scoreboard, Excel | the regression test |
| `tester/`, `judge/`, `docker/` | the regression test, `isolation.py` (shields on and off), `languages.py`, `editor-flow.py` |
| Live events | `live.py` |
| Cheat detection | `cheat-flow.py` |
| Assignment form, export, tests upload | `export-import.py`, `browser.py` |
| Start-up migration, settings, paths | `python2.py` and, for path or schema changes, the migration test |
| Before a release | `tests/run-all.sh` |

## Adding a test

- **Extend an existing script** when the change belongs to its area: add pages to the lists in
  `smoke.py` and `browser.py` (admin and student lists), probes to `PROBES` in `isolation.py`, or
  steps to the relevant flow.
- **A new end-to-end script** goes in `tests/e2e/<name>.py`. Follow the existing ones: a comment on
  the first line with the command to run it, the base URL in a constant `B`, sessions created with
  `POST /api/auth/login` and `POST /api/assignments/select`, a `check(ok, label)` helper that prints
  `OK` / `BAD`, and a non-zero exit code when something failed. Rely on the regression fixtures
  instead of creating users, and restore any setting you change.
- **A new judging case** for the regression test: add a program to `tests/regression/corpus/` and a
  row to `SUBMISSIONS` in `run.py` with the expected status. It runs on both apps, so it must be
  something the legacy app supports.
- Add the script to the table in `tests/README.md` and a `step` to `tests/run-all.sh`.

::: tip
Tests that wait for judging should poll until the queue is empty rather than sleep for a fixed
time; judging time depends on the server. The e2e scripts poll `GET /api/queue` as admin
(`wait_queue()` in `cheat-flow.py`); the regression test counts `shj_queue` and `PENDING` rows over
SSH.
:::
