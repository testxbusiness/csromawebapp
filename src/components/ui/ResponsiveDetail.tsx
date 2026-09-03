'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog'
import { cn } from '@/lib/utils'

type ResponsiveDetailProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullscreenOnMobile?: boolean
  centeredOnMobile?: boolean
  className?: string
  canClose?: () => boolean
}

export function ResponsiveDetail({ open, onOpenChange, title, description, children, footer, size = 'md', fullscreenOnMobile = false, centeredOnMobile = false, className, canClose }: ResponsiveDetailProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && canClose && !canClose()) return; onOpenChange(nextOpen) }}>
      <DialogContent className={cn('cs-responsive-detail', `cs-responsive-detail--${size}`, fullscreenOnMobile && 'cs-responsive-detail--fullscreen-mobile', centeredOnMobile && 'cs-responsive-detail--centered-mobile', className)}>
        <DialogHeader className="cs-responsive-detail__header">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>{description ?? 'Dettaglio'}</DialogDescription>
        </DialogHeader>
        <div className="cs-responsive-detail__body">{children}</div>
        {footer ? <DialogFooter className="cs-responsive-detail__footer">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
