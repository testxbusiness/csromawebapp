import * as React from 'react'

type FieldProps = {
  label?: React.ReactNode
  help?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  children: React.ReactNode
  className?: string
}
export function Field({ label, help, error, required, children, className }: FieldProps) {
  return (
    <div className={`cs-field ${className ?? ''}`}>
      {label && (
        <label className="cs-field__label">
          {label} {required && <span aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {help && !error && <div className="cs-help">{help}</div>}
      {error && <div className="cs-error">{error}</div>}
    </div>
  )
}
