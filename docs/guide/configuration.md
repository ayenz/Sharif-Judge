# Configuration

There are two places: **environment variables** for things the server needs before it starts
(database, secrets, mail server, login method), and the **Settings** page for everything an admin
changes while the judge is running.

## Environment variables

Set them in the `web` service of `docker/compose.yml` (or `docker/.env` for the ones Compose
reads). The Docker setup already sets the paths, the judge mode and the backup folder.

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_DB_HOST`, `NUXT_DB_PORT` | `localhost`, `3306` | MySQL/MariaDB server |
| `NUXT_DB_USER`, `NUXT_DB_PASSWORD`, `NUXT_DB_DATABASE` | | Database credentials |
| `NUXT_DB_PREFIX` | `shj_` | Table prefix |
| `NUXT_SESSION_PASSWORD` | | Session cookie secret, at least 32 characters |
| `NUXT_SESSION_COOKIE_SECURE` | `false` | `true` behind HTTPS |
| `NUXT_TRUST_PROXY` | `false` | Only behind a reverse proxy: `true` (one proxy) or the number of proxies in a row. Trusts that many entries from the right of `X-Forwarded-For` |
| `NUXT_JUDGE_MODE` | `local` (`remote` in Docker) | Where submissions run |
| `NUXT_PATHS_TESTER`, `NUXT_PATHS_ASSIGNMENTS` | | Judge folders (set by the image) |
| `NUXT_CHEAT_JAVA`, `NUXT_CHEAT_JPLAG_JAR`, `NUXT_CHEAT_WORK_DIR` | | JPlag (set by the image); empty disables it |
| `NUXT_BACKUP_DIR` | | Backup folder as seen by the app (set by Compose) |
| `NUXT_QUEUE_ENABLED` | `true` | `false` on extra web replicas |
| `NUXT_MAIL_HOST`, `NUXT_MAIL_PORT`, `NUXT_MAIL_SECURE`, `NUXT_MAIL_USER`, `NUXT_MAIL_PASS` | port 465, secure | SMTP for password resets and new-account mails |
| `NUXT_AUTH_METHOD` | | `ldap` or `radius`, see [Users and sign-in](./users-and-sign-in) |
| `NUXT_TURNSTILE_SITE_KEY`, `NUXT_TURNSTILE_SECRET_KEY` | (off) | Cloudflare Turnstile, see [Users and sign-in](./users-and-sign-in#cloudflare-turnstile) |

Variables read by Compose from `docker/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `SESSION_PASSWORD`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | | Secrets (required) |
| `WEB_DB` | `shj_web` | Database name of the app |
| `BACKUP_DIR` | `docker/backups` | Where backups are stored on the host |
| `BACKUP_TIME`, `BACKUP_KEEP_DAYS`, `TZ` | `02:00`, `14`, `Asia/Jakarta` | Default backup schedule (Settings overrides it) |
| `WEB_PORT` | `8402` | Port of the app, optionally with an address (`127.0.0.1:8402`) |
| `IMAGE` | `sharif-judge-web:latest` | Image name (a second installation on the same server needs its own) |
| `TRUST_PROXY`, `SESSION_COOKIE_SECURE` | `false` | Behind a reverse proxy / HTTPS, see [Installation](./installation#behind-a-reverse-proxy) |
| `WITH_SWIFT` | `0` | `1` builds the image with Swift, see [Installation](./installation#swift) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | (off) | Cloudflare Turnstile, see [Users and sign-in](./users-and-sign-in#cloudflare-turnstile) |

After changing variables, run `docker compose up -d web`.

## Settings page

| Tab | What you set |
|---|---|
| General | Time zone of the judge, tester and assignments folders |
| Judging | File size and output size limits, the default late-penalty rule, Python 2, Java policy, logs |
| Shields | The C/C++ and Python "shields" (blocked functions and imports) and their header files |
| Accounts & Mail | Self-registration and its code, sender address, the password-reset and new-account mail texts |
| Display | Results per page, first day of the week, locking students' display names |
| Backups | Backup status, schedule and retention, "back up now" |

::: tip Time zone
All deadlines and submission times are stored as wall-clock times in the judge time zone. Set it
once before the first assignment and do not change it afterwards.
:::

### Python 2

Python 2 is end-of-life and is not installed in the image, so it is **off** by default: it is hidden
from the assignment form, problem pages and the submit page, and Python 2 submissions are refused.
Turn it on only after adding a `python2` interpreter to the image; the Settings page warns when it is
on but no interpreter is found.

### Mail

Without `NUXT_MAIL_HOST` the app works, but password-reset and new-account mails are not sent (the
server log says so). Templates can use `{SITE_URL}`, `{RESET_LINK}`, `{VALID_TIME}` (reset) and
`{SITE_URL}`, `{ROLE}`, `{USERNAME}`, `{PASSWORD}`, `{LOGIN_URL}` (new account).
