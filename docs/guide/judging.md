# Judging

## What happens to a submission

1. The student uploads a file or submits from the editor. The file is saved and the submission
   enters the **queue** as `PENDING`.
2. The `web` service hands the job to the isolated `judge` container.
3. `tester.sh` compiles the code (or checks the Python syntax) and runs it on every test case with
   the problem's limits.
4. The result is saved, the scoreboard updates, and the student sees a notice at once.

A judged submission becomes the student's **final** submission for that problem. Students can choose
another final submission on All Submissions until the deadline (finish + extra time).

## Results

| Status | Meaning |
|---|---|
| A score | Share of passed tests × problem score × late coefficient |
| Compilation Error / Syntax Error | The code did not compile; the result shows the compiler message |
| Uploaded | Upload-only problem, not judged |
| Judge Error | The judge itself failed; check the queue and the `judge` service |
| Invalid Tester Code | The problem's `tester.cpp` does not compile |

The result of each test (accepted, wrong answer, time limit, memory limit, runtime error, output too
large) is in the submission's result. Staff can also see the full judge log.

## Languages

| Language | Compiled / run with |
|---|---|
| C | `gcc -O2 -lm` |
| C++ | `g++ -O2 -lm` |
| Java | `javac` / `java` with a Security Manager policy (Java 17); the class with `main` is found automatically |
| Python 3 | `python3`, syntax checked first |
| Python 2 | Only when enabled in Settings and a `python2` interpreter is installed |
| JavaScript | Node.js 24 (`node main.js`), syntax checked first. CommonJS (`require`) and ES modules (`import`) both work; read input with `require('fs').readFileSync(0, 'utf8')` or `readline` |
| Go | Go 1.27 (`go build`), a single `package main` file using the standard library |

**Time limits**: Go uses the problem's C/C++ limit, JavaScript the Java limit (Node.js needs some
start-up time, like Java).

**Memory limits** for JavaScript and Go count the memory the program really uses (resident memory)
plus an allowance for the runtime itself: about 64 MB for Node.js and 10 MB for Go. C, C++ and
Python are limited as before. A program that goes over the limit, even briefly, gets *Memory Limit
Exceeded*.

## The queue

**Tools > Queue** lists waiting jobs. **Pause** stops after the current submission, **Resume**
continues, **Empty queue** removes waiting jobs (they stay `PENDING` until rejudged).

## Rejudging

**Tools > Rejudge** rejudges every submission of a problem, for example after fixing a test case.
One submission can be rejudged from All Submissions. Upload-only problems are skipped.

## Shields and isolation

Two layers protect the server and the test data:

1. **The judge container**: no network, no server secrets; code is compiled and run as an
   unprivileged user that cannot read test cases, expected outputs or other students' code. Limits on
   processes, memory and CPUs.
2. **Shields**: C/C++ programs are compiled with headers that block dangerous functions
   (`system`, `fork`, file access, ...), Python programs start with a shield that removes dangerous
   modules and builtins, Java runs under a policy. Edit them in Settings > Shields.

The isolation holds even with the shields off (tested), so the shields are a second line of defence.
See [Security](./security).

## Editor runs and recordings

In the editor, **Run** executes the code once with the student's input (not on the test cases) and
shows the output. Every edit, paste and page switch is recorded; head instructors can replay
recordings on **Tools > Recordings**, and cheat detection uses them as signals.
