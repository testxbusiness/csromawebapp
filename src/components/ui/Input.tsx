'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'cs-input',
          invalid && 'cs-input--invalid',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

interface FieldProps {
  label?: string
  help?: string
  error?: string
  children: React.ReactNode
  className?: string
}

const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ label, help, error, children, className }, ref) => {
    return (
      <div ref={ref} className={cn('cs-field', className)}>
        {label && <label className="cs-label">{label}</label>}
        {children}
        {help && !error && <div className="cs-help">{help}</div>}
        {error && <div className="cs-error">{error}</div>}
      </div>
    )
  }
)

Field.displayName = 'Field'

export { Input, Field }