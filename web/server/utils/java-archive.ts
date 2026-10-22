// Java archives submitted as files: a zip of Java sources ("Java (zip)", file type jzip) or a
// JAR. tester/java_archive.py checks and extracts them for judging; these helpers check an
// upload early, show the code, and give cheat detection the sources.
import { strFromU8, unzipSync } from 'fflate'

const MAX_SOURCE_FILES = 500
const MAX_SOURCE_BYTES = 8 * 1024 * 1024

export interface JavaSource { name: string, text: string }

function unsafe(name: string): boolean {
  const parts = name.replace(/\\/g, '/').split('/')
  return name.startsWith('/') || parts.some(p => p === '..')
}

/** The .java files of a zip, sorted by path. Throws an Error with a message for the student. */
export function javaArchiveSources(data: Uint8Array): JavaSource[] {
  let total = 0
  let count = 0
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(data, {
      filter(file) {
        if (!file.name.endsWith('.java') || file.name.startsWith('__MACOSX/'))
          return false
        if (unsafe(file.name))
          throw new Error(`Unsafe path in the zip file: ${file.name}`)
        total += file.originalSize
        if (++count > MAX_SOURCE_FILES)
          throw new Error(`The zip file has more than ${MAX_SOURCE_FILES} Java files.`)
        if (total > MAX_SOURCE_BYTES)
          throw new Error('The Java files in the zip are too large.')
        return true
      },
    })
  }
  catch (e) {
    const message = (e as Error).message
    throw new Error(/^(Unsafe|The )/.test(message) ? message : 'The file is not a valid zip file.')
  }
  const sources = Object.entries(entries).map(([name, bytes]) => ({ name, text: strFromU8(bytes) }))
  if (!sources.length)
    throw new Error('The zip file contains no .java files.')
  return sources.sort((a, b) => a.name.localeCompare(b.name))
}

/** Entry names of a JAR and its Main-Class, without decompressing the classes. */
function jarContents(data: Uint8Array): { names: string[], mainClass: string | null } {
  const names: string[] = []
  let manifest = ''
  try {
    const entries = unzipSync(data, {
      filter(file) {
        names.push(file.name)
        // unzipSync never writes more than the declared size, so this bounds the memory used
        return file.name === 'META-INF/MANIFEST.MF' && file.originalSize <= 1024 * 1024
      },
    })
    manifest = entries['META-INF/MANIFEST.MF'] ? strFromU8(entries['META-INF/MANIFEST.MF']) : ''
  }
  catch {
    throw new Error('The file is not a valid JAR file.')
  }
  const line = manifest.replace(/\r?\n /g, '').split(/\r?\n/).find(l => /^main-class:/i.test(l))
  return { names, mainClass: line ? line.slice(line.indexOf(':') + 1).trim() : null }
}

/** Problem with an uploaded zip of sources or JAR, or null. tester.sh checks the rest. */
export function javaArchiveCheck(fileType: string, data: Uint8Array): string | null {
  try {
    if (fileType === 'jzip')
      javaArchiveSources(data)
    else if (fileType === 'jar' && !jarContents(data).names.some(n => n.endsWith('.class')))
      return 'The JAR file contains no classes.'
    return null
  }
  catch (e) {
    return (e as Error).message
  }
}

/** Readable text of a submitted archive for the code viewer. */
export function javaArchiveText(fileType: string, data: Uint8Array): string {
  try {
    if (fileType === 'jzip')
      return javaArchiveSources(data).map(s => `// ===== ${s.name} =====\n${s.text.replace(/\s+$/, '')}\n`).join('\n')
    const { names, mainClass } = jarContents(data)
    return [
      '// JAR file: compiled classes, the source code is not included.',
      `// Main-Class: ${mainClass ?? '(none)'}`,
      '',
      ...names.filter(n => !n.endsWith('/')).sort(),
    ].join('\n')
  }
  catch (e) {
    return `// ${(e as Error).message}`
  }
}

/**
 * All sources of a zip as one Java file for JPlag, which compares one file per submission:
 * package lines are dropped and imports moved to the top, so the result still parses.
 */
export function javaArchiveFlatten(sources: JavaSource[]): string {
  const imports = new Set<string>()
  const bodies = sources.map((s) => {
    const kept = s.text.split(/\r?\n/).filter((line) => {
      if (/^\s*package\s+[\w.]+\s*;/.test(line))
        return false
      if (/^\s*import\s+(?:static\s+)?[\w.*]+\s*;/.test(line)) {
        imports.add(line.trim())
        return false
      }
      return true
    })
    return `// ===== ${s.name} =====\n${kept.join('\n').replace(/\s+$/, '')}\n`
  })
  return [...imports, '', ...bodies].join('\n')
}
