'use client'

import { useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'csroma-theme'
export type Theme = 'light' | 'dark'

function getPreferredTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const initialTheme = getPreferredTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)

    const syncTheme = () => setTheme(document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light')
    window.addEventListener('csroma-theme-change', syncTheme)
    return () => window.removeEventListener('csroma-theme-change', syncTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    window.localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    applyTheme(newTheme)
    window.dispatchEvent(new Event('csroma-theme-change'))
  }

  return { theme, toggleTheme }
}
