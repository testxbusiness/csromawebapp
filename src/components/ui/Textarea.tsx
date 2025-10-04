import * as React from 'react'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={`cs-textarea ${invalid ? 'cs-input--invalid' : ''} ${className ?? ''}`}
      {...props}
    />
  )
}
