import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Reads the state of the backup service (docker/backup/backup.sh) from the backup folder,
// which the web app mounts read-only, and sends it requests through backups/control.

export interface BackupStatus {
  /** NUXT_BACKUP_DIR is set (the Docker setup). */
  configured: boolean
  /** The service wrote a heartbeat in the last two minutes. */
  running: boolean
  schedule: { time: string, keepDays: number, timezone: string, next: string } | null
  last: { time: string, epoch?: number, status: 'ok' | 'failed' | 'running', folder: string, message: string } | null
  backups: { name: string, size: number }[]
  runRequested: boolean
}

const dir = () => useRuntimeConfig().backup.dir as string
const json = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  }
  catch {
    return null
  }
}

async function folderSize(path: string): Promise<number> {
  let total = 0
  for (const name of await readdir(path).catch(() => [] as string[]))
    total += (await stat(join(path, name)).catch(() => null))?.size ?? 0
  return total
}

export async function backupStatus(): Promise<BackupStatus> {
  const root = dir()
  if (!root)
    return { configured: false, running: false, schedule: null, last: null, backups: [], runRequested: false }
  const state = await json<{ time: string, keepDays: number, timezone: string, next: string, heartbeat: string, heartbeatEpoch?: number }>(join(root, 'state.json'))
  const last = await json<BackupStatus['last']>(join(root, 'latest.json'))
  // Epoch seconds from the service: independent of its time zone and the judge's.
  const running = !!state?.heartbeatEpoch && Math.abs(Date.now() / 1000 - state.heartbeatEpoch) < 120
  const names = (await readdir(root).catch(() => [] as string[])).filter(n => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort().reverse()
  const backups = await Promise.all(names.map(async name => ({ name, size: await folderSize(join(root, name)) })))
  const runRequested = await stat(join(root, 'control', 'run-now')).then(() => true, () => false)
  return {
    configured: true,
    running,
    schedule: state ? { time: state.time, keepDays: state.keepDays, timezone: state.timezone, next: state.next } : null,
    last,
    backups,
    runRequested,
  }
}

/** Asks the service to make a backup now (it checks every 10 seconds). */
export async function backupRequestRun(): Promise<void> {
  await writeFile(join(dir(), 'control', 'run-now'), new Date().toISOString())
}

/** Daily time (HH:MM, service time zone) and how many days backups are kept. */
export async function backupSetSchedule(time: string, keepDays: number): Promise<void> {
  await writeFile(join(dir(), 'control', 'config.json'), JSON.stringify({ time, keepDays }))
}

/** Problems with backups worth an admin's attention on the dashboard. */
export async function backupWarnings(): Promise<string[]> {
  const s = await backupStatus()
  if (!s.configured)
    return []
  if (!s.running)
    return ['The backup service is not running, so no backups are being made.']
  if (!s.last)
    return ['No backup has been made yet. It runs every day; you can also start one now.']
  if (s.last.status === 'failed')
    return [`The last backup failed (${s.last.time}): ${s.last.message}.`]
  if (s.last.status === 'ok' && s.last.epoch && Date.now() / 1000 - s.last.epoch > 2 * 86400)
    return [`The last backup is from ${s.last.time}, more than two days ago.`]
  return []
}
