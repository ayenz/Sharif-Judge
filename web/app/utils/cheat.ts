import type { CheatLanguage, CheatLevel, CheatRun } from '#shared/cheat'

/** GET /api/cheat/:assignment */
export interface CheatOverview {
  assignment: { id: number, name: string, mossUpdate: string }
  engineAvailable: boolean
  working: boolean
  problems: CheatProblemInfo[]
  runs: (CheatRun & { reportSize: number | null })[]
  otherAssignments: { id: number, name: string, archived: boolean }[]
  moss: { userId: string | null, running: boolean, links: { id: number, name: string, link: string | null }[] }
}

export interface CheatProblemInfo {
  id: number
  name: string
  isUploadOnly: boolean
  counts: Partial<Record<CheatLanguage, number>>
  baseCode: Partial<Record<CheatLanguage, boolean>>
}

export const cheatPercent = (value: number) => `${Math.round(value * 100)}%`

/** Bar and text colors by similarity (0..1): ≥90 red, ≥70 orange, ≥50 amber, else neutral. */
export function cheatSimilarityTone(value: number): { bar: string, text: string } {
  if (value >= 0.9)
    return { bar: 'bg-red-500 dark:bg-red-400', text: 'text-red-600 dark:text-red-300' }
  if (value >= 0.7)
    return { bar: 'bg-orange-500 dark:bg-orange-400', text: 'text-orange-600 dark:text-orange-300' }
  if (value >= 0.5)
    return { bar: 'bg-amber-400 dark:bg-amber-300', text: 'text-amber-600 dark:text-amber-300' }
  return { bar: 'bg-slate-400 dark:bg-slate-500', text: 'text-muted' }
}

export const CHEAT_LEVEL: Record<CheatLevel, { label: string, color: 'error' | 'warning' | 'neutral', icon: string, bar: string, hint: string }> = {
  high: { label: 'Needs review', color: 'error', icon: 'i-lucide-flag', bar: 'bg-red-500 dark:bg-red-400', hint: 'Several strong indicators. Look at the code and the recording before drawing conclusions.' },
  medium: { label: 'Check', color: 'warning', icon: 'i-lucide-eye', bar: 'bg-amber-400 dark:bg-amber-300', hint: 'Some indicators. Worth a quick look.' },
  low: { label: 'OK', color: 'neutral', icon: 'i-lucide-check', bar: 'bg-slate-300 dark:bg-slate-600', hint: 'No notable indicators.' },
}

/** Short chip for one reason of a student signal (the full text goes in a tooltip). */
export function cheatReasonChip(reason: string): { label: string, icon: string } {
  if (/similar/i.test(reason))
    return { label: 'Similar code', icon: 'i-lucide-copy' }
  if (/^Pasted/i.test(reason))
    return { label: 'Large paste', icon: 'i-lucide-clipboard-paste' }
  if (/Left the page (\d+)/i.test(reason))
    return { label: `Left page ×${reason.match(/Left the page (\d+)/i)![1]}`, icon: 'i-lucide-log-out' }
  if (/^Wrote/i.test(reason))
    return { label: 'Very fast', icon: 'i-lucide-zap' }
  return { label: 'Indicator', icon: 'i-lucide-info' }
}

/** Distinct pastel hues for match ranges; the same index is used on both sides of a pair. */
const MATCH_HUES = [257, 150, 30, 320, 85, 195, 355, 115, 285, 55, 225, 170]
export function cheatMatchColor(index: number): string {
  const hue = MATCH_HUES[index % MATCH_HUES.length]!
  const round = Math.floor(index / MATCH_HUES.length)
  return `oklch(${0.76 - round * 0.06} 0.13 ${hue})`
}

/** "Java: https://..." lines of a Moss link file → links (label may be empty). */
export function cheatMossLinks(text: string | null): { label: string, url: string }[] {
  if (!text)
    return []
  const out: { label: string, url: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(?:(.*?):\s*)?(https?:\/\/\S+)$/i)
    if (m)
      out.push({ label: (m[1] ?? '').trim(), url: m[2]! })
  }
  return out
}

export function cheatBytes(size: number | null): string {
  if (size === null)
    return ''
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
