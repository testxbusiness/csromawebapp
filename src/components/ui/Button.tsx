'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  block?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', block = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'cs-btn',
          `cs-btn--${variant}`,
          size === 'sm' && 'cs-btn--sm',
          size === 'lg' && 'cs-btn--lg',
          size === 'icon' && 'cs-btn--icon',
          block && 'cs-btn--block',
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }