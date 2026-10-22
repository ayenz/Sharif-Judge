// Mappings between the language names stored in problems.allowed_languages,
// the file types stored in submissions.file_type, and file extensions.

export const FILE_TYPES = ['c', 'cpp', 'py2', 'py3', 'java', 'js', 'go', 'zip', 'pdf', 'txt'] as const
export type FileType = typeof FILE_TYPES[number]

/** "C++" -> "cpp", "Python 3" -> "py3", ... (case-insensitive). */
export function languageToType(language: string): FileType | null {
  switch (language.trim().toLowerCase()) {
    case 'c': return 'c'
    case 'c++': return 'cpp'
    case 'python 2': return 'py2'
    case 'python 3': return 'py3'
    case 'java': return 'java'
    case 'javascript': return 'js'
    case 'go': return 'go'
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
    case 'js': return 'js'
    case 'go': return 'go'
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
    case 'js': return 'JS'
    case 'go': return 'Go'
    case 'zip': return 'Zip'
    case 'pdf': return 'PDF'
    case 'txt': return 'TXT'
    default: return type
  }
}

/** Languages that are judged (the rest are upload-only). */
export const JUDGED_LANGUAGES = ['C', 'C++', 'Python 2', 'Python 3', 'Java', 'JavaScript', 'Go']
export const ALL_LANGUAGES = [...JUDGED_LANGUAGES, 'Zip', 'PDF', 'TXT']

/** Languages offered for new problems; Python 2 only when enabled in Settings. */
export function judgedLanguages(python2: boolean): string[] {
  return python2 ? JUDGED_LANGUAGES : JUDGED_LANGUAGES.filter(l => l !== 'Python 2')
}

export function allLanguages(python2: boolean): string[] {
  return python2 ? ALL_LANGUAGES : ALL_LANGUAGES.filter(l => l !== 'Python 2')
}

export function parseAllowedLanguages(allowed: string): string[] {
  return allowed.split(',').map(l => l.trim()).filter(Boolean)
}
