'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

type ToastContextValue = {
  push: (t: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let externalPush: ((t: Omit<ToastItem, 'id'>) => void) | null = null

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, any>>({})

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const item: ToastItem = { id, duration: 3500, ...t }
    setToasts(prev => [item, ...prev])
    if (item.duration && item.duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), item.duration)
    }
  }, [remove])

  useEffect(() => {
    externalPush = push
    return () => { externalPush = null }
  }, [push])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 w-[min(380px,92vw)]">
        {toasts.map(t => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export const toast = {
  success(message: string, opts?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) {
    externalPush?.({ type: 'success', message, ...opts }) || window.alert(message)
  },
  error(message: string, opts?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) {
    externalPush?.({ type: 'error', message, ...opts }) || window.alert(message)
  },
  info(message: string, opts?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) {
    externalPush?.({ type: 'info', message, ...opts }) || window.alert(message)
  },
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { type, title, message } = item
  const color = type === 'success' ? 'var(--cs-success)' : type === 'error' ? 'var(--cs-danger)' : 'var(--cs-primary)'

  return (
    <div
      role="status"
      aria-live="polite"
      className="cs-card shadow-md border flex items-start gap-3 p-3 animate-in fade-in slide-in-from-top-2"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="text-lg" aria-hidden>
        {type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}
      </div>
      <div className="flex-1">
        {title && <div className="font-medium leading-tight mb-0.5">{title}</div>}
        <div className="text-sm text-secondary">{message}</div>
      </div>
      <button
        aria-label="Chiudi notifica"
        className="cs-btn cs-btn--ghost cs-btn--sm"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  )
}

