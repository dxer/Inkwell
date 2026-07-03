import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Wraps the app so next-themes can read/set the theme.
 * attribute="class" -> toggles .dark on <html>.
 * defaultTheme="system" -> first visit follows OS preference.
 * enableSystem -> allows system resolution.
 * disableTransitionOnChange -> avoids the slow color-transition on the
 *   very first paint (we re-enable transitions for manual toggles elsewhere).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
