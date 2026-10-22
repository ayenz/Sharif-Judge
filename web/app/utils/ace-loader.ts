import type { Ace } from 'ace-builds'

type AceModule = typeof import('ace-builds')
let loading: Promise<AceModule> | undefined

/** Loads Ace with the modes and themes the judge uses (client only, loaded on demand). */
export function loadAce(): Promise<AceModule> {
  loading ??= (async () => {
    const ace = (await import('ace-builds')).default as unknown as AceModule
    await Promise.all([
      import('ace-builds/src-noconflict/mode-c_cpp'),
      import('ace-builds/src-noconflict/mode-java'),
      import('ace-builds/src-noconflict/mode-javascript'),
      import('ace-builds/src-noconflict/mode-golang'),
      import('ace-builds/src-noconflict/mode-kotlin'),
      import('ace-builds/src-noconflict/mode-swift'),
      import('ace-builds/src-noconflict/mode-python'),
      import('ace-builds/src-noconflict/mode-plain_text'),
      import('ace-builds/src-noconflict/theme-github_light_default'),
      import('ace-builds/src-noconflict/theme-github_dark'),
      import('ace-builds/src-noconflict/ext-searchbox'),
    ])
    return ace
  })()
  return loading
}

/** Ace mode for a language name or file type ("C++", "py3", "java", "JavaScript", "go", ...). */
export function aceModeFor(language: string): string {
  const l = language.toLowerCase()
  if (l === 'javascript' || l === 'js')
    return 'ace/mode/javascript'
  if (l === 'go')
    return 'ace/mode/golang'
  if (l === 'kotlin' || l === 'kt')
    return 'ace/mode/kotlin'
  if (l === 'swift')
    return 'ace/mode/swift'
  if (l.includes('java'))
    return 'ace/mode/java'
  if (l.includes('python') || l.startsWith('py'))
    return 'ace/mode/python'
  if (l === 'c' || l === 'c++' || l === 'cpp' || l.includes('c_cpp'))
    return 'ace/mode/c_cpp'
  return 'ace/mode/plain_text'
}

export function aceTheme(dark: boolean): string {
  return dark ? 'ace/theme/github_dark' : 'ace/theme/github_light_default'
}

export type AceEditor = Ace.Editor
