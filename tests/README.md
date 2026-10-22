# Tests

The tests run against the apps deployed with `docker/compose.yml` (new app on port 8402, legacy
PHP app on port 8401 from the tag `archive/php-final`, see [docker/README.md](../docker/README.md)). They use [uv](https://docs.astral.sh/uv/) to fetch their Python dependencies.
Host names and ports are set at the top of each script (`stillmen.dell` / `172.30.30.101` in the
development setup).

| Test | Command | What it checks |
|---|---|---|
| Regression | `uv run tests/regression/run.py` | Resets both apps, sends 19 identical submissions (C, C++, Java, Python 3, upload; correct, wrong, partial, compile/syntax error, time limit, runtime error, late) and requires identical statuses, scores, coefficients, final flags, scoreboard, Hall of Fame and Excel exports |
| Pages | `uv run --with requests python tests/e2e/smoke.py` | Every page loads for an admin and a student; staff pages return 404 for students |
| Security | `uv run --with requests python tests/e2e/security.py` | Other students' code, path traversal, staff endpoints, re-install, SQL-like input, secrets hidden from submissions, sign-in rate limit (also with a forged `X-Forwarded-For`) |
| Isolation | `uv run --with requests python tests/e2e/isolation.py` | Submissions (C, Python, Java) try to read expected outputs and other students' code, `#include` an answer at compile time, reach the database and read secrets; all must be blocked. Run it once with the shields off in Settings as well |
| Editor | `uv run --with requests python tests/e2e/editor-flow.py` | Save, run with input, submit, recording, rejudge |
| Cheat detection | `uv run --with requests python tests/e2e/cheat-flow.py` | Renamed, reordered and C copies are found, a different solution is not, paste signals, template code, older assignments, access, history across assignments |
| Live updates | `uv run --with requests python tests/e2e/live.py` | Server-sent events: a student gets only their own results, staff get everyone's and queue events |
| Browser | `uv run --with requests --with playwright python tests/e2e/browser.py` | Every page in Chromium: no JavaScript or hydration errors, no horizontal scroll at phone width |

Run the regression test first: the end-to-end tests use the users and assignments it creates
(`admin`/`admin123`, students `alice` … `frank` with password `secret123`). The regression test
**deletes all data** of both apps on the test server.

The browser test needs Chromium once: `uv run --with playwright python -m playwright install chromium`.

## RADIUS

[radius/README.md](radius/README.md) describes a manual test of RADIUS sign-in against FreeRADIUS and
against a forged server.

## Corpora

- `regression/corpus/`: the programs submitted by the regression test, named
  `p<problem>_<language>_<case>`.
- `e2e/cheat/`: an original solution (`alice.py`), a renamed copy (`bob.py`), a reordered copy with
  comments (`dave.py`), an independent solution (`carol.py`), and a C original and copy
  (`erin.c`, `frank.c`).
