import { ReactNode } from 'react'

type FeedbackStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function LoadingState({ label = 'Caricamento in corso...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-sm text-secondary" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-blue-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: FeedbackStateProps) {
  return (
    <div className="cs-card py-12 text-center" role="status">
      <p className="text-secondary mb-2">{title}</p>
      {description && <p className="text-sm text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Si è verificato un errore', description, action }: FeedbackStateProps) {
  return (
    <div className="cs-card py-8 text-center" role="alert">
      <p className="font-medium text-red-700">{title}</p>
      {description && <p className="mt-2 text-sm text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
