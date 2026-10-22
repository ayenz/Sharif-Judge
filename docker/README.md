# Docker

| File | Purpose |
|---|---|
| `web.Dockerfile` | The SharIF Judge image (build context: repository root) |
| `compose.yml` | MariaDB, the web app, the isolated judge, backups, and the legacy PHP app for tests |
| `backup/backup.sh` | Daily backup script (run by the `backup` service) |
| `initdb/` | Creates the `shj_web` and `shj_ci3` databases on the first start of MariaDB |

## The image

`web.Dockerfile` has four stages:

1. **build**: installs the npm packages and builds the Nuxt app.
2. **jplag**: downloads the Java 25 JDK (Eclipse Temurin) and JPlag 6.3 with pinned SHA-256
   checksums, for cheat detection, and makes a runtime with `jlink` that includes `jdk.compiler`
   (JPlag parses Java with it; a plain JRE lacks it and every Java submission failed to parse).
3. **golang**: downloads Go 1.27 with a pinned SHA-256 checksum and builds
   `docker/go-cache-warm.go` once, so `/opt/go-cache` holds the compiled standard packages that
   submissions commonly use. `tester.sh` copies that cache into each Go submission's jail, which
   makes a build take about 0.25 s instead of 4 s.
4. **runtime**: `node:24-bookworm-slim` with `gcc`, `g++`, Java 17, Python 3, Perl and GNU `time`
   for the judge (Node.js itself runs JavaScript submissions), the built app in `/app/web`, the
   judge in `/app/tester`, and the files of stages 2 and 3 in `/opt/jre25`, `/opt/jplag`,
   `/usr/local/go` and `/opt/go-cache`.

The app runs as the unprivileged `node` user on port 3000. Data lives in the `/data` volume:
`/data/assignments` (test cases and submitted files) and `/data/cheat` (cheat detection work files
and reports). EasySandbox is intentionally not built; see the security notes in the main README.

## Services

| Service | Runs | Network | Notes |
|---|---|---|---|
| `db` | MariaDB 10.11 | internal | |
| `web` | Nuxt app as `node` (uid 1000) | internal + port 8402 | Queues submissions as job files in `/data/jobs` (`NUXT_JUDGE_MODE=remote`) |
| `judge` | `judge/worker.mjs` (same image) | **none** | Runs `tester.sh` for each job; submissions are compiled and run as `shjrun` (uid 2000) |
| `backup` | `backup/backup.sh` (MariaDB image) | internal | Daily database dump + assignment files into `BACKUP_DIR` |

Shield files (`/app/tester/shield`) are the named volume `shields`: written by `web` (Settings >
Shields), read by `judge`. It is filled from the image on first start and then keeps the admin's
edits; remove the volume to go back to the defaults.

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
docker compose up -d --build db web judge backup   # app on port 8402
docker compose logs -f web
```

Rebuild after pulling changes with the same `up -d --build db web judge backup`. Database tables for new
features are created when the app starts.

### Using an existing installation

The full procedure is in [docs/guide/migration-from-php.md](../docs/guide/migration-from-php.md). In short:

To run on the database and files of a legacy installation:

- set `WEB_DB` in `.env` to the existing database name (and grant the `shj` user access to it, or
  set `NUXT_DB_*` to the existing credentials in `compose.yml`);
- replace the `web-data:/data` volume with a bind mount whose `assignments` folder is the existing
  one, owned by uid 1000 (the `node` user);
- after the first login, check the tester and assignments paths in **Settings**
  (`/app/tester` and `/data/assignments` in the container).

### Backups

The `backup` service makes one backup a day at `BACKUP_TIME` (default `02:00`, time zone `TZ`,
default `Asia/Jakarta`) and keeps `BACKUP_KEEP_DAYS` days (default `14`). Each backup is a folder in
`BACKUP_DIR` (default `docker/backups`):

```
2026-10-22_0200/
  database.sql.gz   mariadb-dump of the app database
  files.tar.gz      /data/assignments (test cases, descriptions, submitted code, results)
  SHA256SUMS
latest.json         status of the last run
```

Cheat detection work files and the job queue are not backed up; they are rebuilt as needed.

**Settings > Backups** in the app shows whether the service runs, the last and next backup and the
stored backups, has a **Back up now** button, and changes the time and retention (stored in
`BACKUP_DIR/control/config.json`, which overrides `BACKUP_TIME` and `BACKUP_KEEP_DAYS`). The web
app can only read the backups; its one writable folder is `control/`, for these requests. The admin
dashboard warns when the service is not running, no backup exists, the last one failed, or it is
older than two days.

**Keep copies somewhere else.** A backup on the same disk does not survive a disk failure. Point
`BACKUP_DIR` at another disk or a mounted network share, or copy the folders off the server
regularly (for example with `rsync` from another machine). Set `BACKUP_DIR` to an absolute path
outside the repository if you deploy by syncing the repository folder.

```bash
# Make a backup now (or use Settings > Backups)
docker compose exec backup /bin/bash /backup.sh now

# Check a backup
cd backups/2026-10-22_0200 && sha256sum -c SHA256SUMS
```

### Restoring

```bash
B=backups/2026-10-22_0200            # the backup to restore
docker compose stop web judge
# Database (the dump re-creates the database it was taken from)
gunzip < $B/database.sql.gz | docker compose exec -T db mariadb -uroot -p"$DB_ROOT_PASSWORD"
# Files
docker compose run --rm --no-deps -v "$PWD/$B":/restore:ro --entrypoint sh web \
  -c 'rm -rf /data/assignments && tar -xzf /restore/files.tar.gz -C /data'
docker compose up -d web judge
```

To test a backup without touching the live data, restore the dump into a scratch database
(`sed 's/`shj_web`/`shj_restore_test`/g'` on the dump) and compare row counts; this is how the backups
were verified during development.

### Behind a reverse proxy

Terminate HTTPS at the proxy, forward to port 8402, and add
`NUXT_SESSION_COOKIE_SECURE: "true"` and `NUXT_TRUST_PROXY: "true"` to the `web` environment. Cheat detection with Moss can keep a
request open for several minutes; allow a long proxy timeout for `/api/moss/`.

## Legacy app for regression tests

The `legacy` profile runs the last PHP version on port 8401 for `tests/regression`. Its image is in
`tests/regression/legacy/`, and its code comes from the tag `archive/php-final`:

```bash
git archive archive/php-final | tar -x -C ../ci3        # CI3_SRC, default ../ci3
mkdir -p ../ci3/restricted/assignments
docker compose --profile legacy up -d ci3
```
