type Mode = 'light' | 'dark' | 'system'

/**
 * Switches the color mode with a circular reveal starting at the clicked element
 * (View Transitions API); browsers without it just switch instantly.
 */
export function useThemeSwitch() {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value === 'dark')

  function apply(mode: Mode) {
    colorMode.preference = mode
  }

  function setMode(mode: Mode, event?: MouseEvent) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || reduced) {
      apply(mode)
      return
    }
    const target = event?.currentTarget as HTMLElement | undefined
    const rect = target?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.top + rect.height / 2 : 0
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const root = document.documentElement.style
    root.setProperty('--reveal-x', `${x}px`)
    root.setProperty('--reveal-y', `${y}px`)
    root.setProperty('--reveal-r', `${r}px`)
    doc.startViewTransition(() => {
      apply(mode)
      // Make sure the class is on <html> before the new snapshot is taken.
      document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))
    })
  }

  function toggle(event?: MouseEvent) {
    setMode(isDark.value ? 'light' : 'dark', event)
  }

  return { colorMode, isDark, setMode, toggle }
}
