import vm from 'node:vm'

// Late rules are stored as PHP snippets by the legacy app, e.g.
//   if ($delay<=0) $coefficient = 100; elseif (...) $coefficient = ceil(...);
// The arithmetic subset they use is also valid JavaScript once the PHP-only syntax
// is rewritten, so we translate and run them in an isolated VM context.

export function lateRuleToJs(rule: string): string {
  return rule
    .replace(/\$([A-Za-z_]\w*)/g, '$1')
    .replace(/\belseif\b/g, 'else if')
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
}

const helpers = {
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  intval: (v: number) => Math.trunc(Number(v)),
}

/**
 * Evaluates a late rule. Returns the coefficient as stored in the database
 * (a string of at most 6 chars) or "error" when the rule is invalid.
 */
export function evalLateRule(rule: string, delay: number, extraTime: number): string {
  const context = vm.createContext({ ...helpers, delay, extra_time: extraTime, coefficient: undefined })
  try {
    vm.runInContext(lateRuleToJs(rule), context, { timeout: 100 })
  }
  catch {
    return 'error'
  }
  const c = context.coefficient
  if (typeof c !== 'number' || !Number.isFinite(c))
    return 'error'
  return String(c).slice(0, 6)
}

/** Final score from a raw tester score (0..10000), the problem score and a coefficient. */
export function computeScores(preScoreRaw: number, problemScore: number, coefficient: string) {
  const preScore = Math.ceil(preScoreRaw * problemScore / 10000)
  const finalScore = coefficient === 'error' ? 0 : Math.ceil(preScore * Number(coefficient) / 100)
  return { preScore, finalScore }
}
