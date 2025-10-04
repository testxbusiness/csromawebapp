'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle }
  from '@/components/ui/Dialog'

type Props = {
  open: boolean
  title?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function DetailsDrawer({
  open, title, onClose, children, footer, size = 'md',
}: Props) {
  const sizeClass =
    size === 'sm' ? 'cs-modal--sm' :
    size === 'lg' ? 'cs-modal--lg' :
    size === 'xl' ? 'cs-modal--xl' :
    'cs-modal--md'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* nota la classe extra cs-modal--centered */}
      <DialogContent className={`cs-modal ${sizeClass} cs-modal--centered`}>
        {(title || footer) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
          </DialogHeader>
        )}
        <div>{children}</div>
        {footer && <div className="cs-modal__footer">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
