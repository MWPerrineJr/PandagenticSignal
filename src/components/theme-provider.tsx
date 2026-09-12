import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'

/** The app ships a single brand look (neon green on near-black, mirroring pandagentic.ai).
 * The type and hook stay so chart palettes keep their theme-keyed lookup. */
export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode; defaultTheme?: Theme }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({ theme: 'dark' }), [])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
