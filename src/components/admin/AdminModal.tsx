'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface AdminModalProps {
  isOpen: boolean
  title: string
 onClose: () => void
  children: ReactNode
  footer?: ReactNode
  sizeClassName?: string
  closeOnOverlayClick?: boolean
}

const FOCUSABLE_SELECTORS = [
  'a[href]',
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(', ')

export default function AdminModal({
  isOpen,
  title,
  children,
  onClose,
  footer,
  sizeClassName = 'max-w-4xl',
  closeOnOverlayClick = true
}: AdminModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      lastFocusedElementRef.current = document.activeElement as HTMLElement | null
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }

    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus()
      }
      return
    }

    const focusDialog = () => {
      if (!dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        dialogRef.current.focus()
      }
    }

    const timer = window.setTimeout(focusDialog, 0)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab') {
        if (!dialogRef.current) return
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        if (focusable.length === 0) {
          event.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        } else if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick) return
    if (event.target === overlayRef.current) {
      onClose()
    }
  }

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} className="cs-overlay" aria-hidden={!isOpen}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`cs-modal ${sizeClassName} focus:outline-none`}
        data-state="open"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="cs-modal__title">{title}</h3>
          <button type="button" onClick={onClose} className="cs-modal__close" aria-label="Chiudi">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="cs-modal__footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
