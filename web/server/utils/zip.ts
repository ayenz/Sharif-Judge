import type { H3Event } from 'h3'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { unzipSync, zipSync, type Zippable } from 'fflate'

/** Upper bound for the uncompressed size of an uploaded archive (zip bomb guard). */
const MAX_UNCOMPRESSED = 1024 * 1024 * 1024

export interface ZipExtractResult {
  ok: boolean
  files: string[]
  errors: string[]
}

/**
 * Extracts a zip archive into `targetDir`, keeping only files whose extension is in
 * `allowed` (like the legacy Unzip library with `allow()`), skipping `__MACOSX`.
 *
 * Unlike the legacy library, any entry with an absolute path or a `..` segment makes
 * the whole extraction fail (zip-slip), and files without an extension are skipped.
 */
export async function zipExtractSafe(data: Uint8Array, targetDir: string, allowed: string[]): Promise<ZipExtractResult> {
  const errors: string[] = []
  const dirs = new Set<string>()
  let total = 0
  let unsafe = ''

  const clean = (raw: string) => raw.replace(/\\/g, '/')
  const isUnsafe = (name: string) =>
    name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..') || name.includes('\0')

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(data, {
      filter(file) {
        const name = clean(file.name)
        if (isUnsafe(name)) {
          unsafe ||= file.name
          return false
        }
        if (name.split('/')[0] === '__MACOSX')
          return false
        if (name.endsWith('/')) {
          dirs.add(name.replace(/\/+$/, ''))
          return false
        }
        const base = posix.basename(name)
        const dot = base.lastIndexOf('.')
        const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
        if (!ext || !allowed.includes(ext))
          return false
        total += file.originalSize
        if (total > MAX_UNCOMPRESSED)
          throw new Error('Archive is too large when uncompressed.')
        return true
      },
    })
  }
  catch (e) {
    return { ok: false, files: [], errors: [(e as Error).message || 'Invalid zip file.'] }
  }

  if (unsafe)
    return { ok: false, files: [], errors: [`Unsafe path in archive: ${unsafe}`] }

  const names = Object.keys(entries)
  if (!names.length && !dirs.size)
    return { ok: false, files: [], errors: ['ZIP folder was empty.'] }

  try {
    for (const dir of dirs) {
      if (dir && dir.split('/')[0] !== '__MACOSX')
        await mkdir(join(targetDir, ...dir.split('/')), { recursive: true, mode: 0o700 })
    }
    for (const name of names) {
      const path = join(targetDir, ...clean(name).split('/').filter(Boolean))
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      await writeFile(path, entries[name]!)
    }
  }
  catch (e) {
    errors.push((e as Error).message)
    return { ok: false, files: [], errors }
  }
  return { ok: true, files: names, errors }
}

/** Sends a zip built from `{ 'path/in/zip': bytes }` as a download. */
export function zipSend(event: H3Event, filename: string, files: Record<string, Uint8Array>): Buffer {
  const tree: Zippable = {}
  for (const [name, bytes] of Object.entries(files))
    tree[name] = [bytes, { level: 6 }]
  const out = zipSync(tree)
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(out.byteLength),
    'Cache-Control': 'no-store',
  })
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength)
}
