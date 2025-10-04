import * as React from 'react'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
export function Select({ className, invalid, ...props }: SelectProps) {
  return (
    <select
      className={`cs-select ${invalid ? 'cs-input--invalid' : ''} ${className ?? ''}`}
      {...props}
    />
  )
}
