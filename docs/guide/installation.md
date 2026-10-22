# Installation

SharIF Judge runs with Docker Compose. The image contains everything the judge needs: Node.js
(also for JavaScript submissions), `gcc`/`g++`, Java 17, Kotlin 2.4, Python 3, Go 1.27, Perl, and
Java 25 with JPlag for cheat detection. Swift is optional (see [below](#swift)).

## Requirements

- A Linux server with Docker and Docker Compose v2
- 2 CPU cores and 4 GB RAM are comfortable for a class; the judge container is limited to 2 CPUs
  and 2 GB by default
- About 3 GB of disk for the images and build cache (the app image is about 1.5 GB; 2.8 GB with
  Swift), plus space for submissions and backups

The app is designed for a campus network. If it must be reachable from the internet, put it behind
a reverse proxy with HTTPS (see [below](#behind-a-reverse-proxy)).

## Install

```bash
git clone https://github.com/ayenz/Sharif-Judge.git
cd Sharif-Judge/docker
cat > .env <<EOF
SESSION_PASSWORD=$(openssl rand -hex 24)
DB_PASSWORD=$(openssl rand -hex 12)
DB_ROOT_PASSWORD=$(openssl rand -hex 12)
BACKUP_DIR=/var/backups/sharif-judge
EOF
docker compose up -d --build db web judge backup
```

Open `http://<server>:8402`. The first visit shows the installer: it creates the tables, the
default settings and the first admin account. Then sign in and go through
[Configuration](./configuration).

::: warning Keep docker/.env safe
It holds the database passwords and the session secret. Anyone with the session secret can forge
sessions. Do not commit it; it is already in `.gitignore`.
:::

## Swift

The Swift compiler is large (about 1.2 GB even after removing the debugger and tools the judge
does not need), so it is not in the image by default. To offer Swift, add to `docker/.env`:

```bash
WITH_SWIFT=1
```

and build again (`docker compose up -d --build db web judge backup`). The image grows from about
1.5 GB to about 2.8 GB. Without it, Swift does not appear in the problem form or the submit page,
and Swift submissions are refused. Building without `WITH_SWIFT=1` later removes it again.

## The services

| Service | Purpose |
|---|---|
| `db` | MariaDB 10.11 with the `shj_web` database |
| `web` | The app on port 8402 |
| `judge` | Runs submissions; no network, no secrets |
| `backup` | Daily database and file backups (see [Backups](./backups)) |

All four must run. Without `judge`, submissions stay `PENDING`.

## Updating

```bash
cd Sharif-Judge
git pull
cd docker
docker compose up -d --build db web judge backup
```

Database changes for new features are applied automatically when the app starts. Making a backup
first (Settings > Backups > Back up now) is a good habit.

## Behind a reverse proxy

Terminate HTTPS at the proxy (nginx, Caddy, Traefik, ...) and forward to port 8402. Then add to the
`web` service environment in `docker/compose.yml`:

```yaml
NUXT_SESSION_COOKIE_SECURE: "true"   # cookie only over HTTPS
NUXT_TRUST_PROXY: "true"             # real client addresses for the sign-in limits
```

Keep these in mind for the proxy:

- `/api/events` is a long-lived server-sent events connection; disable buffering for it.
- Moss detection (`/api/moss/...`) can keep a request open for several minutes.
- Allow uploads of test-case zip files (100 MB is plenty).

## Without Docker

Possible for development or special setups: Node.js 24, the compilers above on the `PATH`, a
MySQL/MariaDB database, and the environment variables from [Configuration](./configuration). Set
`NUXT_JUDGE_MODE=local` so the app runs `tester.sh` itself. Submissions then run **without** the
judge container's isolation; see [Development > Getting started](/development/getting-started).
