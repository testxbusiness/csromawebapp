'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // Aggiungi le nuove varianti
  variant?: 'default' | 'hover' | 'primary'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'cs-card',
          variant === 'hover' && 'cs-card--hover',
          variant === 'primary' && 'cs-card--primary',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('cs-card__title', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardMeta = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('cs-card__meta', className)} {...props} />
  )
)
CardMeta.displayName = 'CardMeta'

const CardActions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('cs-card__actions', className)} {...props} />
  )
)
CardActions.displayName = 'CardActions'

export { Card, CardTitle, CardMeta, CardActions }
