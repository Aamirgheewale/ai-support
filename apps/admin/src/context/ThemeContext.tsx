import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

// LocalStorage key for theme preference (client-side only, per-user)
const THEME_STORAGE_KEY = 'ui-theme'

/**
 * Get initial theme from localStorage or system preference
 * This is completely client-side and isolated per browser instance
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  // Check localStorage first (user's saved preference)
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  // If no stored preference, check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth()

  // Calculate storage key based on current user (or guest)
  // This ensures User A's theme doesn't overwrite User B's theme
  const getStorageKey = (userId?: string) => {
    return userId ? `theme-pref-${userId}` : 'theme-pref-guest'
  }

  // Get current key based on Auth state
  const currentKey = getStorageKey(user?.userId)

  // Initialize theme with lazy state
  // We try to read from the *expected* key immediately if possible
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'

    // Try reading for the user available at mount (likely guest if auth pending)
    // Note: If auth connects later, the effect below will handle the switch
    // Note 2: We can try to peek at a "last_user" key if we wanted to be clever, but safe default is light
    const key = getStorageKey(user?.userId)
    const stored = localStorage.getItem(key) as Theme | null
    if (stored === 'light' || stored === 'dark') return stored

    // System fallback
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  // Sync effect: When User (and thus Key) changes, load their preference
  useEffect(() => {
    const key = currentKey
    const stored = localStorage.getItem(key) as Theme | null

    if (stored === 'light' || stored === 'dark') {
      if (stored !== theme) {
        setThemeState(stored)
      }
    } else {
      // If new user has no pref, decide default (light)
      // We don't necessarily reset to light if we want to inherit system?
      // Strict rule: If no pref, use Light (or system).
      // Let's use 'light' as safe default for new users, or match system
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const defaultTheme = systemDark ? 'dark' : 'light'
      if (theme !== defaultTheme) {
        setThemeState(defaultTheme)
      }
    }
  }, [currentKey]) // Only run when key changes (user login/logout)

  // Apply effect: Update DOM and Storage whenever Theme or Key changes
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)

    // Save to the CURRENT user's key
    localStorage.setItem(currentKey, theme)
  }, [theme, currentKey])

  const setTheme = (newTheme: Theme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.warn(`Invalid theme: ${newTheme}. Using 'light' instead.`)
      newTheme = 'light'
    }
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
