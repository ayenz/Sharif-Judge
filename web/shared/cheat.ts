// Types shared by the cheat detection API and pages.

export const CHEAT_LANGUAGES = ['c', 'cpp', 'java', 'python3', 'javascript', 'go'] as const
export type CheatLanguage = typeof CHEAT_LANGUAGES[number]

export const CHEAT_LANGUAGE_LABEL: Record<CheatLanguage, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  python3: 'Python',
  javascript: 'JavaScript',
  go: 'Go',
}

/** Submission file type (submissions.file_type) to the JPlag language, or null if not code. */
export function fileTypeToCheatLanguage(fileType: string): CheatLanguage | null {
  switch (fileType) {
    case 'c': return 'c'
    case 'cpp': return 'cpp'
    case 'java':
    case 'jzip': return 'java'
    case 'py2':
    case 'py3': return 'python3'
    case 'js': return 'javascript'
    case 'go': return 'go'
    default: return null
  }
}

export function cheatLanguageExtension(language: CheatLanguage): string {
  return { c: 'c', cpp: 'cpp', java: 'java', python3: 'py', javascript: 'js', go: 'go' }[language]
}

export type CheatRunStatus = 'queued' | 'running' | 'done' | 'failed'

export interface CheatRunOptions {
  /** JPlag minimum match length in tokens; null uses JPlag's default for the language. */
  minTokens: number | null
  /** Other assignments whose final submissions are compared too (older work). */
  compareAssignments: number[]
  baseCode: boolean
}

export interface CheatRun {
  id: number
  assignment: number
  problem: number
  language: CheatLanguage
  status: CheatRunStatus
  options: CheatRunOptions
  createdAt: string
  finishedAt: string | null
  submissions: number
  comparisons: number
  /** Usernames (or old submission labels) whose code could not be parsed. */
  failed: string[]
  error: string
}

export interface CheatSubmissionRef {
  username: string
  displayName: string
  submitId: number
  assignment: number
  assignmentName: string
  problem: number
  /** True when this is a submission from another (older) assignment. */
  old: boolean
}

export interface CheatPair {
  id: number
  runId: number
  problem: number
  language: CheatLanguage
  a: CheatSubmissionRef
  b: CheatSubmissionRef
  /** Average similarity 0..1 (share of both programs covered by matches). */
  similarity: number
  /** Maximum similarity 0..1 (share of the smaller program covered). */
  maxSimilarity: number
  /** Tokens in the longest single matching section. */
  longestMatch: number
}

export interface CheatMatch {
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
  tokens: number
}

export interface CheatPairDetail extends CheatPair {
  problemName: string
  codeA: string
  codeB: string
  matches: CheatMatch[]
}

export type CheatLevel = 'high' | 'medium' | 'low'

export interface CheatStudentSignal {
  username: string
  displayName: string
  problem: number
  problemName: string
  submitId: number
  /** Highest similarity with anyone, 0..1, or null when not analysed yet. */
  similarity: number | null
  closest: { username: string, pairId: number, old: boolean } | null
  /** Characters of the largest single insertion (paste) in the editor, or null without a recording. */
  largestPaste: number | null
  codeLength: number
  /** Times the student left the page while coding, or null without a recording. */
  tabSwitches: number | null
  /** Active coding time in ms, or null without a recording. */
  duration: number | null
  score: number
  level: CheatLevel
  reasons: string[]
}

/** Similarity across assignments (latest analysis of every assignment). */
export interface CheatHistoryAssignment {
  id: number
  name: string
  similarity: number
  pairId: number
}

export interface CheatRepeatPair {
  a: { username: string, displayName: string }
  b: { username: string, displayName: string }
  /** Number of assignments in which the two were similar. */
  count: number
  maxSimilarity: number
  assignments: CheatHistoryAssignment[]
}

export interface CheatHistoryStudent {
  username: string
  displayName: string
  /** Assignments with at least one similar pair involving this student. */
  flaggedAssignments: number
  pairs: number
  maxSimilarity: number
  partners: { username: string, count: number }[]
  assignments: (CheatHistoryAssignment & { partner: string })[]
}

export interface CheatHistory {
  minSimilarity: number
  analysedAssignments: number
  repeatPairs: CheatRepeatPair[]
  students: CheatHistoryStudent[]
}
