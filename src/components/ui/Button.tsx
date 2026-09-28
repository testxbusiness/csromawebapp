'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  block?: boolean
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', block = false, loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'cs-btn min-h-11',
          `cs-btn--${variant}`,
          size === 'sm' && 'cs-btn--sm',
          size === 'lg' && 'cs-btn--lg',
          size === 'icon' && 'cs-btn--icon',
          block && 'cs-btn--block',
          className
        )}
        {...props}
      >
        <span className={cn(loading && 'cs-btn__content--loading')}>{children}</span>
        {loading && <span className="cs-btn__spinner" aria-hidden="true" />}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
