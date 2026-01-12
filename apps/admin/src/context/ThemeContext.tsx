import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
const THEME_STORAGE_KEY = 'vite-ui-theme'

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
  // Initialize theme from localStorage or system preference
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Apply theme to document root element (for Tailwind dark: classes)
  useEffect(() => {
    const root = document.documentElement
    
    // Remove both classes first to ensure clean state
    root.classList.remove('light', 'dark')
    
    // Add the current theme class
    root.classList.add(theme)
    
    // Save to localStorage (client-side only, no server sync)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // Listen for system theme changes (optional - only if no localStorage preference exists)
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    
    // Only listen to system changes if user hasn't set a preference
    if (!storedTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if user hasn't manually set a preference
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          setThemeState(e.matches ? 'dark' : 'light')
        }
      }
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }
      // Fallback for older browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  /**
   * Set theme - completely client-side, no server sync
   * This function only updates local state and localStorage
   */
  const setTheme = (newTheme: Theme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.warn(`Invalid theme: ${newTheme}. Using 'light' instead.`)
      newTheme = 'light'
    }
    
    // Update state (will trigger useEffect to update DOM and localStorage)
    setThemeState(newTheme)
    
    // Explicitly save to localStorage immediately
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
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
