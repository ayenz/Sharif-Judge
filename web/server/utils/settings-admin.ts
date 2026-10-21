import { access, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

/** Tester shield files editable from the settings page (key → file name in <tester>/shield). */
export const SETTINGS_SHIELD_FILES = {
  defc: 'defc.h',
  defcpp: 'defcpp.h',
  shieldPy2: 'shield_py2.py',
  shieldPy3: 'shield_py3.py',
} as const

export type ShieldKey = keyof typeof SETTINGS_SHIELD_FILES

/** Contents of the shield files, null for files that cannot be read. */
export async function settingsReadShields(tester: string): Promise<Record<ShieldKey, string | null>> {
  const base = join(tester.replace(/\/+$/, ''), 'shield')
  const entries = await Promise.all(Object.entries(SETTINGS_SHIELD_FILES).map(async ([key, file]) =>
    [key, await readFile(join(base, file), 'utf8').catch(() => null)] as const))
  return Object.fromEntries(entries) as Record<ShieldKey, string | null>
}

/**
 * Writes shield files whose content changed. Like the legacy app, files that do not
 * exist are skipped and unwritable files produce an error message.
 */
export async function settingsWriteShields(tester: string, values: Partial<Record<ShieldKey, string | null | undefined>>): Promise<string[]> {
  const errors: string[] = []
  const current = await settingsReadShields(tester)
  const base = join(tester.replace(/\/+$/, ''), 'shield')
  for (const [key, file] of Object.entries(SETTINGS_SHIELD_FILES) as [ShieldKey, string][]) {
    const value = values[key]
    if (typeof value !== 'string' || current[key] === null || value === current[key])
      continue
    try {
      await writeFile(join(base, file), value)
    }
    catch {
      errors.push(`File ${file} is not writable. Edit it manually.`)
    }
  }
  return errors
}

export async function settingsPathExists(path: string): Promise<boolean> {
  if (!path)
    return false
  return access(path).then(() => true, () => false)
}

export async function settingsPathWritable(path: string): Promise<boolean> {
  return access(path, constants.W_OK).then(() => true, () => false)
}

/** IANA zones known to the runtime, always including UTC. */
export function settingsTimezones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone')
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}

export function settingsIsValidTimezone(zone: string): boolean {
  if (!zone)
    return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  }
  catch {
    return false
  }
}
