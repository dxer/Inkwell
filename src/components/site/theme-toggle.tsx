import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

/**
 * Light/dark toggle. Two-state (light | dark); defaultTheme=system is set
 * at the provider, so first-time visitors follow OS, and the first toggle
 * persists the explicit choice to localStorage (handled by next-themes).
 *
 * Toggles a .theme-transition class on <html> for the duration of the
 * switch so the smooth background/color transition (styles.css) fires only
 * on user action, not on first paint.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    setTheme(isDark ? 'light' : 'dark')
    // Remove the class after the transition completes so it doesn't linger.
    window.setTimeout(() => root.classList.remove('theme-transition'), 350)
  }

  // Before mounting, render a static Moon icon as placeholder to avoid
  // an empty gap. Moon is the safe default (matches light-mode SSR output).
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="切换主题"
        title="切换主题"
        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Moon className="size-5" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:translate-y-[1px]"
    >
      {isDark ? (
        <Sun className="size-5 transition-transform duration-300" />
      ) : (
        <Moon className="size-5 transition-transform duration-300" />
      )}
    </button>
  )
}
