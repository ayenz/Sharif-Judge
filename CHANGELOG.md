# Changelog

## Unreleased

### New

- **ARM64 servers**: the Docker image builds on ARM64 (aarch64) as well as x86-64. Java 25, Go and
  the optional Swift are downloaded for the build machine's processor, with pinned checksums for
  both.
- **Sub-path installations**: with `BASE_URL=/judge/` in `docker/.env` the judge runs under a path
  of an existing site (`https://example.com/judge/`). Downloads, the PDF viewer, live updates,
  favicons and the links in mails include the path, and the session cookie is limited to it. See
  [Installation](https://ayenz.github.io/Sharif-Judge/guide/installation#under-a-sub-path).
- `docker/.env` also takes `WEB_PORT` (e.g. `127.0.0.1:8402`), `TRUST_PROXY`,
  `SESSION_COOKIE_SECURE` and `IMAGE` (name of the built image); with `COMPOSE_PROJECT_NAME` this
  allows two installations on one server.
- The tests take `SHJ_URL`, `SHJ_SSH` and `SHJ_COMPOSE` to run against another installation.

### Changed

- With `NUXT_TRUST_PROXY=true`, links in mails use the scheme from the proxy's
  `X-Forwarded-Proto` header, so they are `https://` behind a TLS proxy.

### Fixed

- With `NUXT_TRUST_PROXY=true`, the sign-in limits took the client address from the first entry of
  `X-Forwarded-For`, which the client can choose when the proxy appends to the header (nginx's
  `$proxy_add_x_forwarded_for`). A forged header no longer gets around the limits: the last entry,
  added by the proxy, is used. With two proxies in a row (e.g. a Cloudflare Tunnel in front of
  nginx) set `NUXT_TRUST_PROXY=2` (`TRUST_PROXY=2` in `docker/.env`).

## 2.0.0 (2026-10-23)

SharIF Judge 2.0 is a rewrite of the web application from PHP / CodeIgniter 3 to
[Nuxt](https://nuxt.com) (Vue + Node.js). It keeps the database schema, the assignment folder
layout and the judging engine, so an existing 1.x installation can switch over without converting
data. The last PHP version is the git tag `archive/php-final`.

Documentation: https://ayenz.github.io/Sharif-Judge/

### Upgrading from 1.x (PHP)

Follow [Migrating from PHP](https://ayenz.github.io/Sharif-Judge/guide/migration-from-php)
(MIGRATION.md in Indonesian). Make a backup first. The new app runs on the existing database and
`assignments` folder; stored paths are adjusted automatically on the first start. Every
intentional behaviour difference is listed in MIGRATION.md.

### New

- **Modern interface**: Vue components with Nuxt UI, the IF logo and a pastel blue palette, an
  explicit dark mode, and pages that work at phone width. Results appear live when a submission is
  judged.
- **Languages**: besides C, C++, Java and Python 3, now JavaScript (Node.js 24), Go 1.27, Kotlin 2.4,
  Java projects as a zip of sources or as a JAR, and Swift 6.4 as an option in the image
  (`WITH_SWIFT=1`). Python 2 is optional and off by default.
- **Cheat detection** with a local JPlag engine: per problem and language, side-by-side comparison,
  editor signals (large pastes, leaving the page), template code, comparison with older
  assignments and a history of pairs across assignments. Code never leaves the server. Moss is
  still available.
- **Isolated judging**: submissions run in a separate container with no network and no secrets, as
  a user that cannot read test cases or other students' code. Tested with the shields on and off.
- **Backups**: daily database and file backups with retention, shown in Settings, with
  "Back up now".
- **Export and import** of an assignment (tests and settings) to reuse it next semester or on
  another installation.
- **Sign-in limits** against password guessing, verified RADIUS answers.

### Fixed (compared with 1.x)

SQL injection (Hall of Fame, login log), shell command injection (Moss, deleting users, zip
extraction), zip-slip and path traversal, forged RADIUS answers accepted, an expected output left
readable between test cases, and Moss parsing every language as C.

### Requirements

Docker with Docker Compose v2, 2 CPU cores and 4 GB RAM for a class, about 3 GB of disk (the image
is about 1.5 GB, 2.8 GB with Swift). See
[Installation](https://ayenz.github.io/Sharif-Judge/guide/installation).

### Known limitations

- PHP is not a judged language.
- EasySandbox is not used (it does not work on current glibc); the judge container replaces it.
- LDAP sign-in is implemented but has not been tested against a real LDAP server.
- JAR submissions cannot be checked by cheat detection; Java (zip) can.
- Kotlin takes about 4 s to compile per submission.

### Tested

`tests/run-all.sh`: identical results to the PHP version for the same submissions (statuses, scores,
late coefficients, scoreboard, Hall of Fame, Excel exports), plus end-to-end tests of every page,
permissions, security, isolation, the editor, live updates, all languages, Java archives,
export/import, cheat detection and the browser (no errors, no horizontal scroll at phone width).
Migration from a copy of a PHP installation and RADIUS sign-in were tested separately.

## 1.x

Releases 1.4 to 1.5.2 are the PHP / CodeIgniter versions (tags `v1.4`, `v1.4.1`, `v1.5.0-unpar` …
`v1.5.2-unpar`).
