# Judge engine

Submissions are compiled and run by [`tester/tester.sh`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/tester.sh),
the Bash engine from the original Sharif Judge. It moved from `restricted/tester` in the PHP app to
`tester/` and its judging logic was kept as it was, so results stay identical to the legacy app
(the [regression test](./testing#regression-test) checks this). The changes made during the rewrite
are small and listed at the end of this page.

This page covers what goes in, what comes out, how limits and isolation work, and how the web app
and the judge container hand jobs to each other.

## Overview

```
web: judgeItem()                          judge container: worker.mjs
  build 18 positional arguments  ──job──►   bash tester.sh <args>      (cwd /app/tester)
                                             ├─ mkdir jail-<random>, chown to shjrun
                                             ├─ compile as shjrun       (javac / gcc / g++ / py_compile /
                                             │                           node --check / go build)
                                             ├─ for each test i:
                                             │    runcode.sh → timeout → program as shjrun
                                             │    compare out with out/output<i>.txt
                                             └─ print one line: score or error
  status / pre_score  ◄──result──────────  {"output": "<that line>"}
```

In local mode (`NUXT_JUDGE_MODE=local`) the web process runs the same `bash ./tester.sh <args>`
itself, without the job files and without a separate user.

## Arguments

`tester.sh` takes positional arguments. They are built in `judgeItem()` in
[`web/server/utils/queue.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/queue.ts)
in the same order as the legacy `Queueprocess` controller:

| # | tester.sh variable | Value from | Example |
|---|---|---|---|
| 1 | `PROBLEMPATH` | `problemDir()`: `<assignments_root>/assignment_<a>/p<p>` | `/data/assignments/assignment_3/p1` |
| 2 | `UN` | `submissions.username` | `alice` |
| 3 | `MAINFILENAME` | `submissions.main_file_name` (used for Java only) | `Main` |
| 4 | `FILENAME` | `submissions.file_name`, without extension | `Main-12` |
| 5 | `EXT` | `submissions.file_type` | `c`, `cpp`, `java`, `jzip`, `jar`, `py2`, `py3`, `js`, `go` |
| 6 | `TIMELIMIT` | problem time limit for the language, ms ÷ 1000 | `0.5` |
| 7 | `TIMELIMITINT` | `floor(TIMELIMIT) + 1` | `1` |
| 8 | `MEMLIMIT` | `problems.memory_limit`, kB | `50000` |
| 9 | `OUTLIMIT` | setting `output_size_limit` (KB) × 1024, bytes | `1048576` |
| 10 | `DIFFTOOL` | `problems.diff_cmd` | `diff` |
| 11 | `DIFFOPTION` | `problems.diff_arg`, split on whitespace | `-bB` |
| 12 | `LOG_ON` | setting `enable_log` | `1` |
| 13 | `SANDBOX_ON` | setting `enable_easysandbox` | `1` |
| 14 | `C_SHIELD_ON` | `enable_c_shield` for C, `enable_cpp_shield` for C++, else `0` | `1` |
| 15 | `PY_SHIELD_ON` | `enable_py2_shield` / `enable_py3_shield` for Python, else `0` | `0` |
| 16 | `JAVA_POLICY` | setting `enable_java_policy` | `1` |
| 17 | `DISPLAY_JAVA_EXCEPTION_ON` | `assignments.javaexceptions` | `0` |
| 18 | `EXEC_ONLY` | `1` for an editor "Run", else `0` | `0` |

The time limit (6) comes from `c_time_limit` for C, C++ and Go, `java_time_limit` for Java, Java
zips, JARs and JavaScript, and `python_time_limit` for both Pythons. `shj_problems` has no columns for the newer
languages, and legacy tables do not change.

::: warning Multi-word diff arguments shift every later argument
The legacy command line was not quoted, so a `diff_arg` such as `-b -B` became two arguments. The
Nuxt code keeps that behaviour on purpose (`...problem.diffArg.split(/\s+/)`), which means
arguments 12–18 move one place to the right. Use single-word options such as `-bB`, or `ignore` /
`identical`. Do not "fix" this without checking what existing problems store.
:::

Before running, `judgeItem()` writes the command line to `<PROBLEMPATH>/<UN>/log`; `tester.sh`
appends to that file when `enable_log` is on.

## Folder layout

Everything lives under the `assignments_root` setting (`/data/assignments` in Docker). The layout is
the legacy one and must not change, because existing installations are used as they are.

```
assignment_<a>/
  <name>.pdf                    assignment PDF (optional)
  p<p>/
    in/input1.txt … inputN.txt  test inputs
    out/output1.txt … outputN.txt
    tester.cpp                  custom checker (optional)
    tester.executable           compiled checker, cached by tester.sh
    desc.md, desc.html          problem description; <name>.pdf (optional)
    basecode/template.<ext>     template code for cheat detection (optional)
    <username>/
      <base>-<submitId>.<ext>   submitted code (upload or editor)
      result-<submitId>.html    per-test result shown to users
      log-<submitId>            judge log (staff only)
      editor.txt                editor draft
      record.json, record-<submitId>.json   editor recordings
      editor-0.<ext>, exec_in.txt, exec_out.txt, exec_err.txt   editor "Run"
```

- The number of tests is the number of files in `in/` (`ls in | wc -l`); test *i* reads
  `in/input<i>.txt` and compares with `out/output<i>.txt`. Extra files in `in/` therefore break the
  numbering.
- Test archives are uploaded as zip files and unpacked by `assignmentInstallTests()`
  ([`server/utils/assignment-files.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/assignment-files.ts)).
  Only `.txt`, `.cpp`, `.html`, `.md` and `.pdf` entries are extracted; zip-slip paths are refused.
  A new upload removes the old `in/`, `out/`, `tester.cpp`, `tester.executable` and descriptions.
- The web app creates these folders with mode `0700`, owned by the web user (uid 1000).

## Output

`tester.sh` prints **exactly one line** on stdout, and that line is the whole interface:

| Output | Stored as | Meaning |
|---|---|---|
| a number 0–10000 | `status = 'SCORE'`, `pre_score = number` | `passed × 10000 / tests` (integer division) |
| `Compilation Error` | status | C, C++, Java or Go did not compile, or a Java zip / JAR failed its checks |
| `Syntax Error` | status | Python `py_compile` or JavaScript `node --check` failed |
| `Invalid Tester Code` | status | `tester.cpp` did not compile |
| `File Format Not Supported` | status | unknown `EXT` |
| `Judge Error` | status | the tester folder was not writable, the judge did not answer in 30 minutes, or anything else failed |

Other statuses in `shj_submissions` are set by the web app: `PENDING` (queued) and `Uploaded`
(upload-only problems). The status column is `varchar(100)`; longer output is cut.

Next to the stdout line, `tester.sh` writes files into `<PROBLEMPATH>/<UN>/`:

- **`result.html`**: one block per test with `ACCEPT`, `WRONG`, `Time Limit Exceeded`,
  `Memory Limit Exceeded`, `Runtime Error` (optionally with the Java exception name), `Killed`,
  `Process hanged up`, `Killed by a signal` or `Output Size Limit Exceeded`; or the first 10 lines
  of compiler errors (HTML-escaped). It uses the CSS classes `shj_g`, `shj_r`, `shj_o`, `shj_b`,
  styled by `.judge-result` in `web/app/assets/css/main.css`.
- **`log`**: the judge log, when `enable_log` is on.
- **`exec_out.txt`**, **`exec_err.txt`**: only in execute mode (below).

After a score, `Compilation Error` or `Syntax Error`, `judgeItem()` renames `result.html` to
`result-<submitId>.html` and `log` to `log-<submitId>`. These are what `POST /api/submissions/view`
returns (the log only to level ≥ 1).

## Limits

Limits are enforced in three layers:

| Layer | Where | What |
|---|---|---|
| Per test, monitored | [`tester/timeout`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/timeout) (Perl) | CPU time `-t TIMELIMIT`, memory `-m MEMLIMIT` kB (not for Java), output size `-l OUTLIMIT`. Writes `FINISHED` or `SHJ_TIME` / `SHJ_MEM` / `SHJ_HANGUP` / `SHJ_SIGNAL` / `SHJ_OUTSIZE` to the program's stderr file, which `tester.sh` reads to pick the verdict. |
| Per test, hard | [`tester/runcode.sh`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/runcode.sh) | `ulimit -v/-m/-s` of `MEMLIMIT + 10000` kB (not for Java), `ulimit -t TIMELIMITINT` CPU seconds, and coreutils `timeout -s9` at `2 × TIMELIMITINT` wall-clock seconds. For Python the interpreter's own size plus 5000 kB is added to the memory limit. |
| Whole container | `docker/compose.yml` | `pids_limit: 512`, `mem_limit: 2g`, `cpus: 2` |

Java gets its memory limit as `java -mx<MEMLIMIT>k`; `Too small initial heap` or
`java.lang.OutOfMemoryError` is reported as Memory Limit Exceeded. Exit code 137 is reported as
`Killed`, any other non-zero exit code as `Runtime Error`.

If `perl` is missing, `tester.sh` runs programs without the monitor (only the `ulimit` and
`timeout` layer). The image installs Perl.

### JavaScript and Go memory

Node.js and Go reserve far more address space than they use (Node.js fails to start under a
`ulimit -v` below about 4 GB, a Go program under 100 MB), so `runcode.sh` skips the `ulimit -v/-m/-s`
block for `js` and `go`, as it does for Java. Instead:

| Layer | JavaScript | Go |
|---|---|---|
| Runtime limit | `node --max-old-space-size=<MEMLIMIT in MB, at least 16>`; "JavaScript heap out of memory" is Memory Limit Exceeded | `GOMEMLIMIT=<MEMLIMIT>KiB` (makes the garbage collector work harder near the limit); "runtime: out of memory" is Memory Limit Exceeded |
| Monitor | `./timeout --rss -m <MEMLIMIT + 64000>`: resident memory instead of virtual size | `./timeout --rss -m <MEMLIMIT + 10000>` |
| Exact peak | `runcode.sh` runs the program under GNU `time -f %M`, outside `SHJ_RUNAS`, which writes the peak resident memory to `SHJ_PEAK_FILE` (`jail-<n>-peak`, next to the jail, so the program cannot change it); above the same limit is Memory Limit Exceeded | same |

The monitor samples every 50 ms and stops a program that keeps growing; the peak from GNU `time`
catches a short burst between two samples (tested with a 200 MB allocation that ends at once). The
allowances (64000 kB, 10000 kB) are the runtimes' own resident memory. `--rss` is a new option of
`tester/timeout`; without it the monitor measures virtual size as before, so C, C++ and Python
results are unchanged. Go programs run with `GOMAXPROCS=1`, so the garbage collector does not add
CPU time from several cores.

### Java zips and JARs

[`tester/java_archive.py`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/java_archive.py)
runs as `shjrun` inside the jail before anything is compiled or run:

- `sources <zip> src`: extracts only `.java` files into `src/` (at most 500 files, 1 MB each, 8 MB
  in total; paths with `..`, absolute paths and unusual characters are refused), writes
  `sources.txt` for `javac @sources.txt`, and prints the class to run: the only class with a
  `main` method, or the one named `Main` if there are several (package from the `package` line).
- `jar <jar>`: checks that the JAR is a zip with classes, that no class is newer than Java 17
  (class file version 61), and that the manifest's `Main-Class` exists, and prints it.

Its message on failure becomes the *Compilation Error* text. A zip is then compiled with
`javac -proc:none -encoding UTF-8 -d classes @sources.txt` (no annotation processors) and run as
`java -cp classes <main class>`; a JAR is run as `java -cp main.jar <Main-Class>`, not `-jar`, so a
`Class-Path` in its manifest is ignored. Both use the same memory limit, policy, exception handling
and `runcode.sh` treatment as single-file Java. The web app checks uploads early with the same rules
([`server/utils/java-archive.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/server/utils/java-archive.ts)),
shows a zip's sources or a JAR's class list in the code view, and gives cheat detection a zip's
sources joined into one file (`javaArchiveFlatten`: package lines dropped, imports moved to the
top).

### Go build cache

`go build` with an empty cache takes about 4 s, because it compiles the standard packages too. The
image fills `/opt/go-cache` once (`docker/go-cache-warm.go` imports the packages submissions
commonly use). For each Go submission `tester.sh` copies it into the jail (`gocache/`, about 40 MB,
55 ms) and builds with `GOCACHE` there, as `shjrun`, with `CGO_ENABLED=0` and `GOTOOLCHAIN=local`.
A build then takes about 0.25 s. The cache is per submission on purpose: a shared writable cache
would let one submission plant compiled packages for the next. Packages not in the warm program
still work; they are compiled during the build.

## Comparing output

- **Default**: the output and the expected output each get a trailing newline, then
  `DIFFTOOL DIFFOPTION out correctout` decides. For `diff`, `-q` is added. Exit code 0 = accepted.
- **`DIFFOPTION = ignore`**: all spaces, tabs and newlines are removed from both files before
  comparing.
- **`DIFFOPTION = identical`**: compared with no options.
- **Custom checker**: if `p<p>/tester.cpp` exists, it is compiled once with
  `g++ tester.cpp -lm -O2 -o tester.executable` and then called for every test as
  `./shj_tester <input file> <expected output file> out`. Exit code 0 means accepted. A compile
  failure gives `Invalid Tester Code`.

::: warning The custom checker is trusted code
`tester.cpp` is compiled and run without `SHJ_RUNAS`, that is with the judge worker's privileges
(root in the judge container, the web user in local mode). Only head instructors and admins can
upload test archives; treat a checker like any other code you deploy.
:::

## Shields, EasySandbox and the Java policy

These are the legacy, language-level protections. They still apply but are no longer the main line
of defence (that is the container, see [Isolation](#isolation)). JavaScript and Go have no shield;
they rely on the container alone, which `tests/e2e/languages.py` checks.

- **C/C++ shield** (`enable_c_shield`, `enable_cpp_shield`): code containing `#undef` is refused.
  Otherwise `#define main themainmainfunction` is prepended and
  [`shield/shield.c`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/shield/shield.c) (or
  `shield.cpp`) is compiled. It includes `def.h` (from `shield/defc.h` / `defcpp.h`), which
  `#define`s forbidden names such as `system` and `fopen` to undefined identifiers, then includes
  the student's code. A compile error that hits one of those names shows the message written after
  `//` in `def.h`.
- **Python shield** (`enable_py2_shield`, `enable_py3_shield`):
  [`shield/shield_py3.py`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/shield/shield_py3.py)
  is prepended to the code after the syntax check. It disables `os` and removes builtins such as
  `open`, `eval` and `exec`.
- **Java policy** (`enable_java_policy`): `java -Djava.security.manager -Djava.security.policy=java.policy`
  with an empty `grant {}`, so the program has no permissions. The Security Manager was removed in
  Java 24, which is why the tester stays on Java 17 (JPlag has its own Java 25).
- **Java exceptions** (`assignments.javaexceptions`): the exception name is shown only if it is
  listed in [`tester/java_exceptions_list`](https://github.com/ayenz/Sharif-Judge/blob/main/tester/java_exceptions_list).
  The location is never shown.
- **EasySandbox** (`enable_easysandbox`, default `1`): `EasySandbox.so` is not built in the image
  (it does not work on current glibc), so `tester.sh` logs "EasySandbox is not built. Disabling
  EasySandbox..." and continues. The setting has no effect.

Admins can edit `defc.h`, `defcpp.h`, `shield_py2.py` and `shield_py3.py` on the Settings page
(`server/utils/settings-admin.ts`).

::: tip Shield files live in a shared volume
In Docker, `/app/tester/shield` is the named volume `shields`, mounted read-write in `web` (the
Settings page writes it) and read-only in `judge`, so edits reach the judge and survive rebuilds.
The volume is filled from the image on its first start only: later changes to `tester/shield/` in the
repository do not replace an admin's edits. To reset them, remove the volume
(`docker compose down` then `docker volume rm sharif-judge_shields`) and start again.
:::

Java's main class is taken from the source: the `public class` that contains
`public static void main`. The file is copied to `<Class>.java` before `javac`; if `javac` asks for
another file name, it retries once with that name.

## Isolation

In the Docker setup, the judge container
([`judge/worker.mjs`](https://github.com/ayenz/Sharif-Judge/blob/main/judge/worker.mjs)) runs
`tester.sh` with this environment and nothing else:

```js
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
LANG=en_US.UTF-8
HOME=/tmp
SHJ_RUN_UID=2000
SHJ_RUNAS="setpriv --reuid=2000 --regid=2000 --clear-groups --no-new-privs env HOME=/tmp"
```

`tester.sh` uses them in two places:

- **`SHJ_RUN_UID`**: after creating `jail-<random>` in the tester folder, `tester.sh` chowns it to
  that uid, so `shjrun` can write there and nowhere else.
- **`SHJ_RUNAS`**: a command prefix in front of every compiler call (`javac`, `gcc`, `g++`,
  `python -m py_compile`) and, inside `runcode.sh`, in front of the program. Compiling as `shjrun`
  matters: it blocks compile-time tricks such as `#include "/data/assignments/…/output1.txt"`.

The program still gets its input and writes its output: `runcode.sh` opens `<input` and `>out` as
root before switching user, so the program reads stdin and writes stdout without needing access to
the files themselves. After each test `tester.sh` removes the previous expected output
(`rm -f correctout tmp1`); in the legacy version it stayed readable in the jail during the next
test.

Permissions that make this hold (set in `web.Dockerfile` and again by the worker on start-up):

| Path | Mode | Effect for `shjrun` |
|---|---|---|
| `/data`, `/data/assignments`, `/app/tester` | `711` | can pass through, cannot list |
| `/data/jobs`, `/data/cheat` | `700` | no access |
| assignment, problem and user folders | `700` (created by the web app) | no access to tests, answers or other students' code |
| `jail-<random>` | owned by uid 2000 | its only writable place |

The container itself has no network (`network_mode: none`), drops all capabilities except
`CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETUID`, `SETGID` and `KILL`, and sets `no-new-privileges`.
[`tests/e2e/isolation.py`](https://github.com/ayenz/Sharif-Judge/blob/main/tests/e2e/isolation.py)
checks that C, Python and Java programs cannot read answers or other code, `#include` an answer,
reach the database or see `NUXT_*` variables, also with the shields off; `tests/e2e/languages.py`
runs the same probes from JavaScript (plus a shell started from Node.js) and Go.

In local mode `SHJ_RUNAS` and `SHJ_RUN_UID` are empty: programs run as the web user with only
`PATH`, `LANG` and `HOME` in their environment. Secrets are hidden, files are not.

## Job files between web and judge

The web app and the judge container share only the `/data` volume. In remote mode a job goes
through `/data/jobs` (`NUXT_JUDGE_JOBS_DIR` on the web side, `SHJ_JOBS_DIR` on the judge side):

1. **Web** (`runRemote()` in `queue.ts`) writes `<id>.job.json.tmp` containing `{"args": [...]}` and
   renames it to `<id>.job.json`. The rename makes the file appear complete. `<id>` is a 15-digit
   millisecond timestamp plus 8 random hex characters, so names sort by time.
2. **Judge** (`worker.mjs`) lists `*.job.json` every 250 ms, sorted by name, and claims one by
   renaming it to `<id>.running`. A failed rename means someone else took it.
3. The worker **validates** the job: at least 17 string arguments, the problem path inside
   `SHJ_DATA_ROOT` (`/data/assignments`) without `..`, an alphanumeric username. Invalid jobs are
   not run and get `Judge Error`.
4. It runs `tester.sh`, removes leftover `jail*` folders, and **chowns** what `tester.sh` created
   (files in the user folder, the problem folder, `tester.executable`) to uid 1000.
5. It writes `<id>.result.json.tmp` with `{"output": "<stdout>"}`, chowns it to uid 1000, renames it
   to `<id>.result.json` and deletes `<id>.running`.
6. **Web** polls for `<id>.result.json` every 250 ms, reads and deletes it. After 30 minutes without
   a result it deletes the job file and stores `Judge Error`.

On start-up the worker renames any `*.running` back to `*.job.json`, so a job claimed by a crashed
worker runs again. Because the web queue handles one item at a time, there is normally at most one
job in the folder.

::: tip The assignments root must be inside /data/assignments
The worker refuses jobs whose problem path does not start with `/data/assignments/`. In Docker the
`assignments_root` setting must therefore be `/data/assignments` (the start-up migration sets it
when a legacy path does not exist). The worker uses its own `SHJ_TESTER` (`/app/tester`); the
`tester_path` setting is only used by the web side.
:::

### File ownership

| Who | uid | Owns / writes |
|---|---|---|
| web (`node`) | 1000 | `/data/assignments` tree, `/data/jobs`, `/data/cheat`, submitted files, job files |
| judge worker | 0 (root) | runs `tester.sh`; chowns its output back to 1000 |
| submitted code | 2000 (`shjrun`) | only `jail-<random>` |
| backup service | root, MariaDB image | reads `/data` read-only, writes `BACKUP_DIR`; creates `control/` owned by 1000 |

If the web app cannot rename `result.html` or read a result, look for files owned by root in the
user folder: the chown step was skipped (for example because the job was invalid).

## Editor "Run" (execute mode)

The code editor's **Run with custom input** uses the same queue with type `exec`
(`POST /api/submit/editor` with `mode: 'execute'`):

1. The web app writes the input to `<UN>/exec_in.txt`, the code to `<UN>/editor-0.<ext>`, and
   `Queueing...` to `exec_out.txt`, then queues a temporary submission with **`submit_id = 0`**.
   While that row exists, another Run answers "Still in queue".
2. `tester.sh` gets `EXEC_ONLY = 1`: it compiles as usual, then runs the program once with
   `exec_in.txt` as input instead of the test cases. Compiler messages, the program output, any
   limit message and finally `Total Execution Time: … ms` go to `exec_out.txt`; stderr goes to
   `exec_err.txt`.
3. The queue removes the submission row with id 0 and publishes `executed` to the user.
4. The page reads `GET /api/submit/editor/<problem>/output`, which reports the run as finished once
   `exec_out.txt` contains `Total Execution Time`.

Editor runs never count as submissions: the id 0 row is never final, is deleted after the run, and
is excluded explicitly from submission lists and cheat detection.

## Changes made to the engine during the rewrite

- `SHJ_RUN_UID` / `SHJ_RUNAS` hooks in `tester.sh` and `runcode.sh` (empty in local mode, so the
  behaviour there is unchanged).
- `rm -f correctout tmp1` before each test (legacy bug: the previous expected output stayed in the
  jail).
- The web app passes arguments as an array (no shell) and starts `tester.sh` with a minimal
  environment.
- Java zips and JARs (`jzip`, `jar`): `java_archive.py` and a check/compile block in `tester.sh`;
  they share the Java run branches through `JAVA_TARGET` (see [Java zips and JARs](#java-zips-and-jars)).
- JavaScript and Go (`js`, `go`): compile and run branches in `tester.sh`, the `--rss` option in
  `timeout`, and `runcode.sh` skips the virtual-memory limit for them (see
  [JavaScript and Go memory](#javascript-and-go-memory)).

## Adding a language

SharIF Judge does not support adding languages through configuration; it is a code change in
several places. JavaScript and Go were added this way, so `git log -- tester/tester.sh` and the
`js` / `go` branches show a complete example.

1. **`tester/tester.sh`**: a compile block for the new `EXT` (prefix compiler calls with
   `$SHJ_RUNAS`, write `result.html` and call `shj_finish "Compilation Error"` on failure), and a run
   branch in both the test loop and the execute section that calls `./runcode.sh` with the
   `./timeout` monitor, like the existing languages.
2. **`tester/runcode.sh`**: only if the runtime needs special memory handling (as Java, Python,
   JavaScript and Go do). Check first whether the runtime starts under `ulimit -v`; if not, use
   `./timeout --rss` and the peak check like JavaScript and Go.
3. **The image** (`docker/web.Dockerfile`): install the compiler or runtime in the runtime stage.
4. **[`web/shared/languages.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/shared/languages.ts)**:
   the language name (stored in `problems.allowed_languages`), the file type (stored in
   `submissions.file_type`, at most **6 characters**), the extension and the label; add it to
   `JUDGED_LANGUAGES`.
5. **`web/server/utils/queue.ts`**: which time limit applies. `shj_problems` only has
   `c_time_limit`, `python_time_limit` and `java_time_limit`, and legacy tables must not change
   (see [Database](./database#rules)); reuse one of them or keep extra limits in a new table. Also
   decide which shield setting, if any, is passed.
6. **Cheat detection**: `CHEAT_LANGUAGES`, `fileTypeToCheatLanguage` and
   `cheatLanguageExtension` in [`web/shared/cheat.ts`](https://github.com/ayenz/Sharif-Judge/blob/main/web/shared/cheat.ts)
   if JPlag supports the language, plus `DEFAULT_MIN_TOKENS` in `server/utils/cheat.ts` and
   `MOSS_LANGUAGE` in `server/utils/moss.ts`. `cheat_runs.language` is `varchar(10)`.
7. **UI**: editor modes in `app/utils/ace-loader.ts` and `recordingAceMode()` in
   `app/utils/recording.ts`; the language list in `AssignmentForm.vue` comes from `shared/languages.ts`.
8. **Tests**: the regression test compares with the legacy app, which does not know the new
   language, so test it in its own script like `tests/e2e/languages.py` (accepted, wrong, compile
   error, time limit, runtime error, memory limit including a short burst, "Run", isolation probes)
   and add copies to `tests/e2e/cheat-flow.py`.
9. **Docs**: the language tables in `docs/guide/judging.md` and this page.
