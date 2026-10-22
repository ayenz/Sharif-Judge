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
| Cheat detection | `uv run --with requests python tests/e2e/cheat-flow.py` | Renamed, reordered, C, Java, Kotlin, JavaScript, Go and (if installed) Swift copies are found, a different solution is not, paste signals, template code, older assignments, access, history across assignments |
| JavaScript, Go, Kotlin, Swift | `uv run --with requests python tests/e2e/languages.py` | 33 programs (`e2e/languages/`): accepted, wrong, syntax/compile error, time limit, runtime error, memory limit (growing and a short burst), a program that fits the limit, a Go package outside the build cache, Kotlin `main` in an object, Swift with Foundation; "Run" in the editor; isolation probes from each language. Without Swift in the image, the Swift cases are skipped and Swift must be hidden and refused |
| Export and import | `uv run --with requests --with playwright python tests/e2e/export-import.py` | An export carries `assignment.json`; importing it in the add form (Chromium) gives the same problems and files with the schedule, participants and open flag reset; a zip without it is refused with a message; the export zip still works as a tests upload; `assignment.json` never lands in the assignment folder |
| Java zip and JAR | `uv run --with requests python tests/e2e/java-archives.py` | Zips of sources (packages, default package, several `main`s, compile error, wrong, runtime error, memory) and JARs built in the container (runnable, no manifest, missing main class, compiled for Java 21) get the expected result; bad uploads are refused; the tester's extractor refuses paths leaving the folder; the editor refuses archives; code view and download; a zip is matched with a single Java file by cheat detection and a JAR is left out |
| Python 2 setting | `uv run --with requests python tests/e2e/python2.py` | Off by default, hidden and refused while off, can be switched on and off, re-created for old installs |
| Live updates | `uv run --with requests python tests/e2e/live.py` | Server-sent events: a student gets only their own results, staff get everyone's and queue events |
| Browser | `uv run --with requests --with playwright python tests/e2e/browser.py` | Every page in Chromium: no JavaScript or hydration errors, no horizontal scroll at phone width |

The scripts use the test database root password `shj_root` (the Compose default when
`DB_ROOT_PASSWORD` is not set), so keep that default on the test server.

Run the regression test first: the end-to-end tests use the users and assignments it creates
(`admin`/`admin123`, students `alice` … `frank` with password `secret123`). The regression test
**deletes all data** of both apps on the test server.

The browser test needs Chromium once: `uv run --with playwright python -m playwright install chromium`.

## Migration from PHP

[migration/README.md](migration/README.md): a Nuxt instance on a copy of a PHP installation is
compared with the PHP app (`uv run tests/migration/verify.py`).

## RADIUS

[radius/README.md](radius/README.md) describes a manual test of RADIUS sign-in against FreeRADIUS and
against a forged server.

## Corpora

- `regression/corpus/`: the programs submitted by the regression test, named
  `p<problem>_<language>_<case>`.
- `e2e/cheat/`: an original solution (`alice.py`), a renamed copy (`bob.py`), a reordered copy with
  comments (`dave.py`), an independent solution (`carol.py`), a C original and copy
  (`erin.c`, `frank.c`), a JavaScript original and copy (`alice.js`, `bob.js`), and a Go original,
  copy and independent solution (`carol.go`, `dave.go`, `erin.go`), and a Java original, renamed copy and independent
  solution (`alice.java`, `bob.java`, `carol.java`), the same for Kotlin (`alice.kt`, `bob.kt`,
  `carol.kt`) and Swift (`dave.swift`, `erin.swift`, `frank.swift`).
- `e2e/languages/`: JavaScript and Go programs for `languages.py`, named `<language>_<case>`.
