'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger'
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'cs-alert',
          `cs-alert--${variant}`,
          className
        )}
        {...props}
      />
    )
  }
)

Alert.displayName = 'Alert'

export { Alert }