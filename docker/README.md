# Docker

| File | Purpose |
|---|---|
| `web.Dockerfile` | The SharIF Judge image (build context: repository root) |
| `compose.yml` | MariaDB, the web app, the isolated judge, and optionally the legacy PHP app |
| `initdb/` | Creates the `shj_web` and `shj_ci3` databases on the first start of MariaDB |
| `legacy-php.Dockerfile`, `php.ini` | Image for the legacy CodeIgniter app (profile `legacy`) |

## The image

`web.Dockerfile` has three stages:

1. **build**: installs the npm packages and builds the Nuxt app.
2. **jplag**: downloads a Java 25 runtime (Eclipse Temurin) and JPlag 6.3 with pinned SHA-256
   checksums, for cheat detection.
3. **runtime**: `node:24-bookworm-slim` with `gcc`, `g++`, Java 17, Python 3 and Perl for the
   judge, the built app in `/app/web`, the judge in `/app/tester`, and the stage-2 files in
   `/opt/jre25` and `/opt/jplag`.

The app runs as the unprivileged `node` user on port 3000. Data lives in the `/data` volume:
`/data/assignments` (test cases and submitted files) and `/data/cheat` (cheat detection work files
and reports). EasySandbox is intentionally not built; see the security notes in the main README.

## Services

| Service | Runs | Network | Notes |
|---|---|---|---|
| `db` | MariaDB 10.11 | internal | |
| `web` | Nuxt app as `node` (uid 1000) | internal + port 8402 | Queues submissions as job files in `/data/jobs` (`NUXT_JUDGE_MODE=remote`) |
| `judge` | `judge/worker.mjs` (same image) | **none** | Runs `tester.sh` for each job; submissions are compiled and run as `shjrun` (uid 2000) |

The judge container needs root only to switch to `shjrun` and to hand result files back to uid
1000; all other capabilities are dropped. `/data`, `/data/assignments` and `/app/tester` are
`711` and `/data/jobs` is `700`, so `shjrun` cannot list or read anything outside its jail.

## Running

```bash
cd docker
cat > .env <<EOF
SESSION_PASSWORD=$(openssl rand -hex 24)
DB_PASSWORD=$(openssl rand -hex 12)
DB_ROOT_PASSWORD=$(openssl rand -hex 12)
EOF
docker compose up -d --build db web judge   # app on port 8402
docker compose logs -f web
```

Rebuild after pulling changes with the same `up -d --build db web judge`. Database tables for new
features are created when the app starts.

### Using an existing installation

To run on the database and files of a legacy installation:

- set `WEB_DB` in `.env` to the existing database name (and grant the `shj` user access to it, or
  set `NUXT_DB_*` to the existing credentials in `compose.yml`);
- replace the `web-data:/data` volume with a bind mount whose `assignments` folder is the existing
  one, owned by uid 1000 (the `node` user);
- after the first login, check the tester and assignments paths in **Settings**
  (`/app/tester` and `/data/assignments` in the container).

### Backups

Back up the database and the `/data` volume:

```bash
docker compose exec -T db mariadb-dump -uroot -p"$DB_ROOT_PASSWORD" shj_web > shj_web.sql
docker run --rm -v sharif-judge_web-data:/data -v "$PWD":/backup busybox tar czf /backup/data.tgz /data
```

### Behind a reverse proxy

Terminate HTTPS at the proxy, forward to port 8402, and add
`NUXT_SESSION_COOKIE_SECURE: "true"` and `NUXT_TRUST_PROXY: "true"` to the `web` environment. Cheat detection with Moss can keep a
request open for several minutes; allow a long proxy timeout for `/api/moss/`.

## Legacy app for regression tests

The `legacy` profile runs the CodeIgniter app on port 8401 from a copy of the legacy code
(`CI3_SRC`, default `../ci3`, created with `git archive main`). The regression test in
`tests/regression` drives both apps and compares the results.

```bash
docker compose --profile legacy up -d ci3
```
