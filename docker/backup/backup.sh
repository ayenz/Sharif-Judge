#!/bin/bash
# SharIF Judge backup: database dump + assignment files, once a day.
#
#   backup.sh          run forever, one backup per day at $BACKUP_TIME (HH:MM, $TZ)
#   backup.sh now      make one backup and exit
#
# Each backup is a folder /backups/YYYY-MM-DD_HHMM with database.sql.gz,
# files.tar.gz (the assignments folder) and SHA256SUMS. Folders older than
# $BACKUP_KEEP_DAYS days are removed. /backups/latest.json tells the web app
# how the last run went.
set -uo pipefail

BACKUP_TIME=${BACKUP_TIME:-02:00}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
DB_NAME=${BACKUP_DB:-shj_web}
DB_HOST=${BACKUP_DB_HOST:-db}
export MYSQL_PWD=${MARIADB_ROOT_PASSWORD:?MARIADB_ROOT_PASSWORD is required}

log() { echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

write_status() { # ok|failed, folder, message
  printf '{"time":"%s","status":"%s","folder":"%s","message":"%s"}\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2" "$3" > /backups/latest.json.tmp
  mv /backups/latest.json.tmp /backups/latest.json
}

run_backup() {
  local stamp dir size
  stamp=$(date +%Y-%m-%d_%H%M)
  dir="/backups/$stamp.partial"
  rm -rf "$dir" && mkdir -p "$dir"
  log "starting $stamp"
  if ! mariadb-dump -h "$DB_HOST" -uroot --single-transaction --quick --routines --databases "$DB_NAME" | gzip -6 > "$dir/database.sql.gz"; then
    log "database dump failed"; rm -rf "$dir"; write_status failed "" "database dump failed"; return 1
  fi
  if ! tar -C /data -czf "$dir/files.tar.gz" assignments; then
    log "archiving files failed"; rm -rf "$dir"; write_status failed "" "archiving files failed"; return 1
  fi
  (cd "$dir" && sha256sum database.sql.gz files.tar.gz > SHA256SUMS)
  mv "$dir" "/backups/$stamp"
  find /backups -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime "+$KEEP_DAYS" -exec rm -rf {} +
  size=$(du -sh "/backups/$stamp" | cut -f1)
  write_status ok "$stamp" "$size"
  log "done $stamp ($size), keeping $KEEP_DAYS days"
}

seconds_until() { # HH:MM -> seconds until the next occurrence
  local now target
  now=$(date +%s)
  target=$(date -d "today $1" +%s)
  [ "$target" -le "$now" ] && target=$(date -d "tomorrow $1" +%s)
  echo $((target - now))
}

case "${1:-loop}" in
  now) run_backup ;;
  loop)
    log "daily backups at $BACKUP_TIME ($TZ), keeping $KEEP_DAYS days, database $DB_NAME"
    while true; do
      sleep "$(seconds_until "$BACKUP_TIME")"
      run_backup || log "backup failed, next try tomorrow"
      sleep 61
    done ;;
  *) echo "usage: backup.sh [now]"; exit 2 ;;
esac
