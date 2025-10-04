import * as React from 'react'

type StatVariant = 'primary' | 'accent' | 'neutral'
type StatProps = {
  label: React.ReactNode
  value: React.ReactNode
  description?: React.ReactNode
  variant?: StatVariant
  className?: string
}
export function Stat({ label, value, description, variant = 'neutral', className }: StatProps) {
  const variantClass =
    variant === 'primary' ? 'cs-stat--primary' :
    variant === 'accent'  ? 'cs-stat--accent'  : 'cs-stat--neutral'

  return (
    <div className={`cs-stat ${variantClass} ${className ?? ''}`}>
      <div className="cs-stat__label">{label}</div>
      <div className="cs-stat__value">{value}</div>
      {description && <div className="cs-stat__description">{description}</div>}
    </div>
  )
}
