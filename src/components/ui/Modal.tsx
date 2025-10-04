'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'
type ModalVariant = 'default' | 'danger'

type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: ModalSize
  variant?: ModalVariant
  fullscreenOnMobile?: boolean
  closable?: boolean
  closeOnOverlayClick?: boolean
}

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  variant = 'default',
  fullscreenOnMobile = false,
  closable = true,
  closeOnOverlayClick = true,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const modalRef = React.useRef<HTMLDivElement | null>(null)
  const lastActiveElRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => { setMounted(true) }, [])

  // lock scroll & restore focus
  React.useEffect(() => {
    if (!mounted) return
    if (open) {
      lastActiveElRef.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      }, 0)
    } else {
      document.body.style.overflow = ''
      lastActiveElRef.current?.focus?.()
    }
    return () => { document.body.style.overflow = '' }
  }, [open, mounted])

  // ESC
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && closable) onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closable, onOpenChange])

  if (!mounted || !open) return null

  const modalSizeClass =
    size === 'sm' ? 'cs-modal--sm' :
    size === 'lg' ? 'cs-modal--lg' :
    size === 'xl' ? 'cs-modal--xl' :
    'cs-modal--md'

  const modalVariantClass = variant === 'danger' ? 'cs-modal--danger' : ''
  const mobileClass = fullscreenOnMobile ? 'cs-modal--fullscreen' : ''

  const overlay = (
    <div
      ref={overlayRef}
      className="cs-overlay"
      aria-hidden="false"
      onMouseDown={(e) => {
        if (!closeOnOverlayClick) return
        if (e.target === overlayRef.current) onOpenChange(false)
      }}
    >
      <div
        ref={modalRef}
        className={`cs-modal ${modalSizeClass} ${modalVariantClass} ${mobileClass}`}
        role="dialog"
        aria-modal="true"
      >
        {(title || description || icon) && (
          <div className="cs-modal__header">
            {icon && <div className="cs-modal__icon" aria-hidden>{icon}</div>}
            <div>
              {title && <h2 className="cs-modal__title">{title}</h2>}
              {description && <p className="cs-modal__description">{description}</p>}
            </div>
          </div>
        )}

        <div>{children}</div>

        {footer && <div className="cs-modal__footer">{footer}</div>}

        {closable && (
          <button
            type="button"
            className="cs-modal__close"
            aria-label="Chiudi"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
