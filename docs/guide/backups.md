# Backups

The `backup` service makes one backup a day and keeps them for 14 days. Each backup holds:

- `database.sql.gz`: a dump of the app database
- `files.tar.gz`: the assignments folder (test cases, descriptions, submitted code, results)
- `SHA256SUMS`: checksums of both

Cheat detection work files and the job queue are not backed up; they are rebuilt when needed.

## Settings > Backups

The tab shows whether the backup service runs, the last and next backup, and the stored backups. It
has a **Back up now** button and sets the daily time and how many days backups are kept. The
dashboard warns admins when the service is not running, no backup exists, the last one failed, or it
is older than two days.

The app can only read the backups. Its one writable folder, `control/`, carries the schedule and the
"back up now" request to the backup service.

## Where backups are stored

`BACKUP_DIR` in `docker/.env` (default `docker/backups`). **Keep copies elsewhere**: a backup on the
same disk does not survive a disk failure. Point `BACKUP_DIR` at another disk or a mounted network
share, or copy the folders to another machine regularly, for example from that machine:

```bash
rsync -a judge-server:/var/backups/sharif-judge/ /srv/backups/sharif-judge/
```

## From the command line

```bash
cd Sharif-Judge/docker
docker compose exec backup /bin/bash /backup.sh now     # make one now
cd /var/backups/sharif-judge/2026-10-22_0200 && sha256sum -c SHA256SUMS   # check one
```

## Restoring

```bash
cd Sharif-Judge/docker
set -a; . ./.env; set +a
B=/var/backups/sharif-judge/2026-10-22_0200      # the backup to restore
docker compose stop web judge
gunzip < $B/database.sql.gz | docker compose exec -T db mariadb -uroot -p"$DB_ROOT_PASSWORD"
docker compose run --rm --no-deps -v "$B":/restore:ro --entrypoint sh web \
  -c 'rm -rf /data/assignments && tar -xzf /restore/files.tar.gz -C /data'
docker compose up -d web judge
```

This procedure was tested by deleting submissions, a user and files and restoring them: everything
came back.

::: tip Test your backups
To check a backup without touching the live data, restore the dump into a scratch database (replace
`` `shj_web` `` with another name in the dump) and compare row counts.
:::
