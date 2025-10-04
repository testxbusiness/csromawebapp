'use client'
import * as React from 'react'

type Tab = { id: string; label: React.ReactNode }
type TabsProps = {
  tabs: Tab[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  className?: string
}

export function Tabs({ tabs, value, defaultValue, onValueChange, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? tabs[0]?.id)
  const current = value ?? internal

  const set = (id: string) => {
    if (!value) setInternal(id)
    onValueChange?.(id)
  }

  return (
    <div className={`cs-tabs ${className ?? ''}`}>
      {tabs.map(t => (
        <button
          key={t.id}
          className="cs-tab"
          aria-selected={current === t.id}
          onClick={() => set(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault()
              const i = tabs.findIndex(x => x.id === current)
              const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length
              set(tabs[next].id)
            }
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
