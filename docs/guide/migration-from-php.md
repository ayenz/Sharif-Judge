# Migrating from the PHP version

The Nuxt version uses the same database tables and the same assignment folder layout as the
PHP/CodeIgniter version, so an existing installation keeps its users, passwords, assignments,
test cases, submissions, scores and editor recordings.

This procedure was tested end to end: a Nuxt instance running on a copy of a PHP installation's
database and files gave identical submissions, scoreboards, Excel exports and Hall of Fame, opened
the code and results of every submission, and produced the same scores when every problem was
rejudged (`tests/migration/`).

## What carries over, what changes

| | |
|---|---|
| Users and passwords | Kept. PHP password hashes are accepted as they are. |
| Assignments, problems, test cases, descriptions, PDFs | Kept. |
| Submissions, scores, late coefficients, final choices | Kept. Late rules written in PHP are translated automatically. |
| Scoreboard, Hall of Fame | Recomputed from the submissions (same results). |
| Editor recordings | Kept and replayable. |
| Settings | Kept. The tester and assignments folders are switched to the container's folders automatically (see step 5). |
| Sessions | Not migrated: everybody signs in again. |
| Python 2 | **Turned off** (end-of-life, not in the image). Turn it on in Settings only if you add a `python2` interpreter. |
| Edited shield files (`tester/shield/*`) | Not migrated: the new install uses its own tester folder. Re-apply your changes in Settings > Shields. |
| Moss | The user id is kept; open Cheat Detection > Moss and save it once to re-create the Moss script. |
| New tables (cheat detection) | Created automatically on start-up. |

**Supported source:** the SharIF Judge PHP version of FTIS UNPAR / ifunpar (`Version-1`, the tag
`archive/php-final` in this repository). The older original Sharif Judge (mjnaderi, v1.4) lacks the
`logins` and `recording` tables and the `archived_assignment` column and is not supported as is.

## Before you start

- Plan a short downtime: no submissions should arrive during the copy.
- Note the PHP settings **Tester path** and **Assignments root** (Settings page): you need the
  assignments folder.
- Have Docker and Docker Compose on the new server (see [Installation](./installation)).

## Steps

### 1. Stop the PHP app and back it up

Put the PHP site in maintenance (or stop the web server), then back up the database and the
assignments folder:

```bash
mysqldump --single-transaction -u root -p sharif_judge | gzip > php-database.sql.gz
tar -C /path/to/restricted -czf php-assignments.tar.gz assignments
```

Keep these files: they are also your way back.

### 2. Prepare the new installation

```bash
git clone https://github.com/ayenz/Sharif-Judge.git
cd Sharif-Judge/docker
printf "SESSION_PASSWORD=%s\nDB_PASSWORD=%s\nDB_ROOT_PASSWORD=%s\n" \
  "$(openssl rand -hex 24)" "$(openssl rand -hex 12)" "$(openssl rand -hex 12)" > .env
set -a; . ./.env; set +a
docker compose up -d db
```

### 3. Import the database

Import into the database the app uses (`shj_web`). The dump may contain `CREATE DATABASE` /
`USE` lines for the old name; import it into `shj_web` explicitly:

```bash
gunzip < php-database.sql.gz \
  | sed -e '/^CREATE DATABASE/d' -e '/^USE /d' \
  | docker compose exec -T db mariadb -uroot -p"$DB_ROOT_PASSWORD" shj_web
```

If your tables use a prefix other than `shj_`, set `NUXT_DB_PREFIX` for the `web` service.

> Using the existing MySQL server instead of the bundled MariaDB is possible (set `NUXT_DB_HOST`,
> `NUXT_DB_USER`, `NUXT_DB_PASSWORD`, `NUXT_DB_DATABASE` on the `web` service), but **use a copy of
> the database**: on start-up the app rewrites the tester and assignments paths in the settings, and
> the PHP app would then no longer find its folders.

### 4. Copy the assignment files

Copy the assignments folder into the app's data volume and give it to the app user (uid 1000).
Remove `tester.executable` files compiled on the old server; they are rebuilt on first use.

```bash
docker compose run --rm --no-deps --user root -v "$PWD/php-assignments.tar.gz":/in.tgz:ro \
  --entrypoint sh web -c '
    rm -rf /data/assignments && tar -xzf /in.tgz -C /data &&
    find /data/assignments -name tester.executable -delete &&
    chown -R 1000:1000 /data/assignments && chmod 711 /data /data/assignments'
```

### 5. Start the app

```bash
docker compose up -d --build web judge backup
docker compose logs web | grep migrate
```

The log shows the folder settings being switched, for example:

```
[migrate] tester_path: "/var/www/html/restricted/tester" does not exist here, using "/app/tester"
[migrate] assignments_root: "/var/www/html/restricted/assignments" does not exist here, using "/data/assignments"
```

### 6. Check

Sign in as an admin and go through this list:

- [ ] The dashboard shows no folder warnings.
- [ ] Assignments show a coefficient (not `error`) — an `error` means a late rule needs fixing.
- [ ] All Submissions and Scoreboard show the same numbers as the PHP site did.
- [ ] Opening **Code** and the result of an old submission works.
- [ ] Rejudge one problem (Tools > Rejudge) and watch it finish in the Queue.
- [ ] A test account can submit and gets judged.
- [ ] Settings: review Shields (step "What changes"), mail and registration settings.
- [ ] Cheat Detection > Moss: save the user id once if you use Moss.

### 7. Tell the users

- Everyone signs in again (same username and password).
- Bookmarks to old URLs may change (for example `/halloffame` is now `/hall-of-fame`).
- Python 2 is no longer offered unless you turned it on.

## Rolling back

The PHP installation is untouched as long as you imported a **copy** of the database (step 3).
To go back, start the PHP web server again. If the PHP app used the same database, restore it from
`php-database.sql.gz` (step 1) first.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard: folder "is not writable" | Run the `chown -R 1000:1000 /data/assignments` from step 4 again. |
| Every submission ends with `Judge Error` | Check that the `judge` service runs: `docker compose ps judge`, `docker compose logs judge`. |
| Problems with a custom tester fail | A `tester.executable` from the old server is left: delete it (step 4). |
| Nobody can sign in | Check `NUXT_DB_*` and that the import went into `shj_web`; check `docker compose logs web`. |
| Late coefficient shows `error` | Edit the assignment: the save dialog shows the rule's syntax error. |
