import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AttendanceStatus = 'going' | 'maybe' | 'declined' | 'pending'
export type StatusBadgeStatus = AttendanceStatus | 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const STATUS_LABELS: Record<StatusBadgeStatus, string> = {
  going: 'Partecipo',
  maybe: 'Forse',
  declined: 'Non partecipo',
  pending: 'Da confermare',
  success: 'Completato',
  warning: 'Da verificare',
  danger: 'Errore',
  neutral: 'Informazione',
  info: 'Informazione',
}

const STATUS_VARIANTS: Record<StatusBadgeStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  going: 'success',
  maybe: 'warning',
  declined: 'danger',
  pending: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
  info: 'info',
}

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusBadgeStatus
  icon?: ReactNode
  label?: string
}

export function StatusBadge({ status, icon, label, className, ...props }: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={cn('cs-status-badge', `cs-status-badge--${STATUS_VARIANTS[status]}`, className)}
    >
      {icon ? <span aria-hidden="true" className="cs-status-badge__icon">{icon}</span> : null}
      <span>{label ?? STATUS_LABELS[status]}</span>
    </span>
  )
}
