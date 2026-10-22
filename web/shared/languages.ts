// Mappings between the language names stored in problems.allowed_languages,
// the file types stored in submissions.file_type, and file extensions.

export const FILE_TYPES = ['c', 'cpp', 'py2', 'py3', 'java', 'jzip', 'jar', 'kt', 'js', 'go', 'swift', 'zip', 'pdf', 'txt'] as const
export type FileType = typeof FILE_TYPES[number]

/** "C++" -> "cpp", "Python 3" -> "py3", ... (case-insensitive). */
export function languageToType(language: string): FileType | null {
  switch (language.trim().toLowerCase()) {
    case 'c': return 'c'
    case 'c++': return 'cpp'
    case 'python 2': return 'py2'
    case 'python 3': return 'py3'
    case 'java': return 'java'
    case 'java (zip)': return 'jzip'
    case 'jar': return 'jar'
    case 'kotlin': return 'kt'
    case 'javascript': return 'js'
    case 'go': return 'go'
    case 'swift': return 'swift'
    case 'zip': return 'zip'
    case 'pdf': return 'pdf'
    case 'txt': return 'txt'
    default: return null
  }
}

export function typeToExtension(type: string): string | null {
  switch (type.toLowerCase()) {
    case 'c': return 'c'
    case 'cpp': return 'cpp'
    case 'py2':
    case 'py3': return 'py'
    case 'java': return 'java'
    case 'jzip': return 'zip'
    case 'jar': return 'jar'
    case 'kt': return 'kt'
    case 'js': return 'js'
    case 'go': return 'go'
    case 'swift': return 'swift'
    case 'zip': return 'zip'
    case 'pdf': return 'pdf'
    case 'txt': return 'txt'
    default: return null
  }
}

/** Short label shown in tables ("C++", "Py 3", ...). */
export function typeToLabel(type: string): string {
  switch (type.toLowerCase()) {
    case 'c': return 'C'
    case 'cpp': return 'C++'
    case 'py2': return 'Py 2'
    case 'py3': return 'Py 3'
    case 'java': return 'Java'
    case 'jzip': return 'Java zip'
    case 'jar': return 'JAR'
    case 'kt': return 'Kotlin'
    case 'js': return 'JS'
    case 'go': return 'Go'
    case 'swift': return 'Swift'
    case 'zip': return 'Zip'
    case 'pdf': return 'PDF'
    case 'txt': return 'TXT'
    default: return type
  }
}

/** Languages that are judged (the rest are upload-only). */
export const JUDGED_LANGUAGES = ['C', 'C++', 'Python 2', 'Python 3', 'Java', 'Java (zip)', 'JAR', 'Kotlin', 'JavaScript', 'Go', 'Swift']

/**
 * Judged languages submitted as an archive (several Java files in a zip, or a JAR): file upload
 * only, not the editor. Not selected by default for new problems; instructors opt in.
 */
export const ARCHIVE_LANGUAGES = ['Java (zip)', 'JAR']

/** File types that are archives: shown as a listing in the code viewer and downloadable. */
export function isArchiveType(type: string): boolean {
  return type === 'jzip' || type === 'jar'
}
export const ALL_LANGUAGES = [...JUDGED_LANGUAGES, 'Zip', 'PDF', 'TXT']

/**
 * Languages offered for problems. `unavailable` are the ones this judge cannot run right now
 * (Python 2 while disabled in Settings, Swift when the image was built without it); they are
 * hidden everywhere and refused on submit.
 */
export function judgedLanguages(unavailable: readonly string[] = []): string[] {
  return JUDGED_LANGUAGES.filter(l => !unavailable.includes(l))
}

/** Languages selected for a new problem: the judged ones except the archive languages. */
export function defaultProblemLanguages(unavailable: readonly string[] = []): string[] {
  return judgedLanguages(unavailable).filter(l => !ARCHIVE_LANGUAGES.includes(l))
}

export function allLanguages(unavailable: readonly string[] = []): string[] {
  return ALL_LANGUAGES.filter(l => !unavailable.includes(l))
}

export function parseAllowedLanguages(allowed: string): string[] {
  return allowed.split(',').map(l => l.trim()).filter(Boolean)
}
