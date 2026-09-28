import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { eventKindVisual } from '@/lib/events/event-kind'

type EventKindBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  kind?: string | null
  fallback?: string
}

/** Renders an event category without borrowing an operational status color. */
export function EventKindBadge({ kind, fallback = 'N/D', className, ...props }: EventKindBadgeProps) {
  const visual = eventKindVisual(kind)

  if (!visual) {
    return kind ? (
      <span {...props} className={cn('text-secondary', className)} aria-label="Tipo evento non disponibile">
        {fallback}
      </span>
    ) : null
  }

  return (
    <span
      {...props}
      className={cn(visual.className, className)}
      aria-label={props['aria-label'] ?? visual.ariaLabel}
    >
      {visual.label}
    </span>
  )
}
