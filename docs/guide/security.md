# Security

## Running student code

Every submission is code written by someone else, so it runs in the `judge` container, never in the
web app:

| Protection | Effect |
|---|---|
| `network_mode: none` | Programs cannot reach the database, other services or the internet |
| No secrets | The container has no database password or session key; `tester.sh` gets only `PATH`, `LANG`, `HOME` |
| Unprivileged user `shjrun` | Code is compiled and run as uid 2000, which owns only its jail folder and cannot read test cases, expected outputs or other students' code (also not through `#include` at compile time) |
| Limits | Per-test time, memory and output limits; 512 processes, 2 GB, 2 CPUs for the container |
| Capabilities | All dropped except those needed to switch user; `no-new-privileges` |
| Shields and Java policy | Second layer: blocked functions, modules and permissions |

`tests/e2e/isolation.py` tries to read answers and other students' code from C, Python and Java, to
`#include` an answer file, to reach the database and to read secrets. All are blocked, also with the
shields turned off.

::: warning EasySandbox
The original EasySandbox for C/C++ does not work on current systems and was never built by the PHP
installation either. The judge container replaces it.
:::

## Accounts

- Passwords are stored with bcrypt.
- Sign-in attempts are limited (see [Users and sign-in](./users-and-sign-in#sign-in-limits)).
- Sessions are encrypted cookies (`NUXT_SESSION_PASSWORD`); changing the secret signs everybody out.
- RADIUS answers are verified with the shared secret.

## Network

On a campus network the app can run over plain HTTP, but passwords then travel unencrypted on a
shared network (Wi-Fi). If possible, put it behind HTTPS (see
[Installation](./installation#behind-a-reverse-proxy)).

## Fixed in the Nuxt version

The rewrite fixed several problems of the PHP version: SQL injection (Hall of Fame, login log), shell
command injection (Moss, deleting users, zip extraction), zip-slip and path traversal, forged RADIUS
answers, and an expected output that stayed readable between test cases. MIGRATION.md in the
repository lists every intentional change.

## Reporting a problem

Open a confidential report to the maintainers rather than a public issue for security problems.
