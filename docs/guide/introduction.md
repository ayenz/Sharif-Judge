# Introduction

SharIF Judge is an online judge for programming courses. Instructors publish assignments with
problems and test cases; students submit code; the judge compiles and runs every submission
against the test cases and records a score. It is meant to run on a server inside the campus
network.

## Who does what

| Role | Level | Can |
|---|---|---|
| Student | 0 | See assignments and problems, submit, see their own submissions, scoreboard, Hall of Fame |
| Instructor | 1 | Also see everybody's submissions and logs, download final submissions |
| Head instructor | 2 | Also add and edit assignments, problems, notifications; rejudge; manage the queue; cheat detection; recordings |
| Admin | 3 | Also manage users, settings, backups and the 24-hour login log |

## Features

- **Assignments**: several problems each, start and finish time, extra time with a late-penalty
  rule, participant lists, PDF and Markdown/HTML descriptions, archived assignments.
- **Judging**: C, C++, Java (also projects as a zip of sources or a JAR), Kotlin, Python 3,
  JavaScript and Go; Python 2 and Swift optional. Output is compared with `diff` or a
  custom tester. Time, memory and output limits. A queue with pause, resume and rejudge.
- **Submitting**: file upload, or the built-in editor with "Run" on custom input. Results appear
  live as soon as a submission is judged.
- **Results**: final and all submissions, scoreboard, Hall of Fame, Excel exports, zip downloads.
- **Cheat detection**: JPlag analysis, side-by-side comparison, review scores that combine
  similarity with editor signals, and a history across assignments. Moss is still available.
- **Accounts**: bulk user creation, optional self-registration with a code, password reset by
  email, optional LDAP or RADIUS sign-in.
- **Operations**: daily backups, an isolated judge container, sign-in rate limits.

## How it is built

| Part | What it is |
|---|---|
| `web/` | The application: a [Nuxt](https://nuxt.com) app (pages, API, judge queue, cheat detection) |
| `judge/` | A small worker that runs submissions in the isolated `judge` container |
| `tester/` | The judging engine, a Bash script that compiles and runs one submission |
| `docker/` | Docker image and Compose file: `db`, `web`, `judge`, `backup` services |

The [Development](/development/architecture) section explains the architecture in detail.

## History

SharIF Judge is a fork of [Sharif Judge](https://github.com/mjnaderi/Sharif-Judge) by Mohammad
Javad Naderi, continued from 2017 by Stillmen Vallian ([@ayenz](https://github.com/ayenz)) and then
by FTIS UNPAR ([ifunpar/SharIF-Judge](https://github.com/ifunpar/SharIF-Judge)).
The web application was rewritten from PHP/CodeIgniter 3 to Nuxt in 2026, keeping the database and
the judging engine; the last PHP version is the git tag `archive/php-final`. Existing PHP
installations can [migrate](./migration-from-php).
