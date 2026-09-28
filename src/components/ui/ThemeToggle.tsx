'use client'

import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme: toggleAppTheme } = useTheme()
  const isDark = theme === 'dark'
  const [isPulsing, setIsPulsing] = useState(false)

  const toggleTheme = () => {
    setIsPulsing(true)
    toggleAppTheme()

    setTimeout(() => setIsPulsing(false), 300)
  }

  return (
    <button
      className={`cs-theme-toggle ${isPulsing ? 'is-pulsing' : ''} ${className || ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
      aria-pressed={isDark}
      type="button"
    >
      <div className="cs-theme-toggle__svg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          {/* Show Sun when in light theme (isDark === false) */}
          {!isDark && (
            <g className="sun">
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </g>
          )}

          {/* Show Moon when in dark theme (isDark === true) */}
          {isDark && (
            <g className="moon">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
            </g>
          )}
        </svg>
      </div>
    </button>
  )
}
