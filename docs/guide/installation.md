# Installation

SharIF Judge runs with Docker Compose. The image contains everything the judge needs: Node.js
(also for JavaScript submissions), `gcc`/`g++`, Java 17, Kotlin 2.4, Python 3, Go 1.27, Perl, and
Java 25 with JPlag for cheat detection. Swift is optional (see [below](#swift)).

## Requirements

- A Linux server with Docker and Docker Compose v2, on x86-64 (amd64) or ARM64 (aarch64, e.g.
  Ampere or Graviton servers). The image is built on the server, so it matches the processor;
  every language, including the optional Swift, is available on both
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

Terminate HTTPS at the proxy (nginx, Caddy, Traefik, a Cloudflare Tunnel, ...) and forward to the
app. Then add to `docker/.env`:

```bash
SESSION_COOKIE_SECURE=true   # cookie only over HTTPS
TRUST_PROXY=true             # real client addresses for the sign-in limits, https links in mails
WEB_PORT=127.0.0.1:8402      # reachable only through the proxy (proxy on the same server)
```

and apply it with `docker compose up -d db web judge backup`.

With `TRUST_PROXY=true` the app takes the client address from the last entry of
`X-Forwarded-For`, the one the proxy adds; earlier entries can be sent by the client. When two
proxies forward one after the other (e.g. a Cloudflare Tunnel to nginx, which both add an entry),
set `TRUST_PROXY=2`; otherwise every client would get the address of the first proxy and share
its sign-in limit. Clients must not reach port 8402 directly (they could send their own header):
bind it to `127.0.0.1` as above, or block it in the firewall. The proxy must pass the original
`Host` header (nginx: `proxy_set_header Host $host`) and set `X-Forwarded-Proto`; mail links are
built from them.

Keep these in mind for the proxy:

- `/api/events` is a long-lived server-sent events connection; disable buffering for it.
- Moss detection (`/api/moss/...`) can keep a request open for several minutes.
- Allow uploads of test-case zip files (100 MB is plenty).

## Under a sub-path

To serve the judge from a path of an existing site, e.g. `https://example.com/judge/`, add to
`docker/.env`:

```bash
BASE_URL=/judge/
```

Start with and end with a slash. The app then expects every request under `/judge/` (pages, API,
scripts, live updates), so the proxy must pass the path **unchanged**: in nginx, `proxy_pass`
without a path after the address. The session cookie is limited to the same path, so two
installations on one domain do not share it. With `BASE_URL` set, the app no longer answers at
`/` on its own port; open `http://<server>:8402/judge/` to reach it directly.

An nginx example (inside the `server` block of the site):

```nginx
location = /judge { return 301 /judge/; }

location /judge/ {
  proxy_pass http://127.0.0.1:8402;          # no path: /judge/... is passed on as it is
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";
  proxy_buffering off;                       # live updates (/judge/api/events)
  proxy_read_timeout 600s;                   # Moss detection
  client_max_body_size 100m;                 # test-case zips
}
```

Use it together with the settings of [the previous section](#behind-a-reverse-proxy). Links in
mails (new accounts, password reset) include the path. Changing `BASE_URL` needs only a restart
(`docker compose up -d web`), not a rebuild.

## Two installations on one server

Each copy needs its own folder (a clone of the repository) and, in its `docker/.env`, its own
project name, image name and port, so containers, volumes and images do not collide:

```bash
COMPOSE_PROJECT_NAME=shj-demo
IMAGE=sharif-judge-demo:latest
WEB_PORT=127.0.0.1:8410
```

## Without Docker

Possible for development or special setups: Node.js 24, the compilers above on the `PATH`, a
MySQL/MariaDB database, and the environment variables from [Configuration](./configuration). Set
`NUXT_JUDGE_MODE=local` so the app runs `tester.sh` itself. Submissions then run **without** the
judge container's isolation; see [Development > Getting started](/development/getting-started).
