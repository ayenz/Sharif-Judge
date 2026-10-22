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
| Kotlin | Kotlin 2.4 (`kotlinc`), run on the Java 17 runtime like Java (same policy and exception handling). A top-level `fun main()` or a `main` with `@JvmStatic` in an `object`. Compiling takes about 4 s |
| Swift | Swift 6.4 (`swiftc -O`), standard library and Foundation. **Optional**: only when the image is built with `WITH_SWIFT=1` (see [Installation](./installation#swift)); otherwise Swift is not offered |
| Java (zip) | A `.zip` of `.java` files, in folders for packages if needed. Only `.java` files are taken; they are compiled together with `javac` and run like Java. The class with `main` runs; if several classes have one, the class named `Main` |
| JAR | A runnable `.jar` (with `Main-Class` in its manifest), run with `java -cp main.jar <Main-Class>`. Classes must be compiled for Java 17 or older (`--release 17`, or language level 17 in the IDE) |

**Time limits**: Go and Swift use the problem's C/C++ limit; Kotlin, JavaScript, Java (zip) and JAR
the Java limit (they run on a virtual machine that needs some start-up time, like Java).

### Java projects: zip or JAR

Both are for exercises with several classes or packages. They are not selected by default for a new
problem: tick them under the problem's allowed languages. Students submit them with **Upload a
file** (the editor is for single files). Compared with each other:

| | Java (zip) | JAR |
|---|---|---|
| Cheat detection | Yes, together with single-file Java submissions | No: a JAR holds compiled classes, not source code |
| Staff can read the code | Yes, every file in the code view | No, only the list of classes |
| Common mistakes caught before running | no `.java` files, no or several `main` classes, compile errors | not a JAR, no `Main-Class`, compiled for a newer Java |

Prefer **Java (zip)** unless the exercise is about building a JAR. Problems are reported as
*Compilation Error* with a message that says what to fix. The upload size limit (Settings > File
size limit, default 50 KB) also applies to zips and JARs; raise it if students submit larger
projects.

**Memory limits** for JavaScript and Go count the memory the program really uses (resident memory)
plus an allowance for the runtime itself: about 64 MB for Node.js and 10 MB for Go. Kotlin is limited
like Java. Swift is limited like C, plus the size of the Swift libraries the program loads (about
70 MB with `import Foundation`, almost nothing without), the way Python's interpreter is added. C,
C++ and Python are limited as before. A program that goes over the limit, even briefly, gets *Memory Limit
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
