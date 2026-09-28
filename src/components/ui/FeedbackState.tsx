import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type FeedbackVariant = 'loading' | 'refreshing' | 'empty' | 'filtered-empty' | 'denied' | 'offline' | 'error' | 'success'
export type FeedbackStateProps = { variant: FeedbackVariant; title?: string; description?: string; action?: ReactNode; className?: string }

const DEFAULT_COPY: Record<FeedbackVariant, { title: string; description?: string }> = {
  loading: { title: 'Caricamento in corso...' }, refreshing: { title: 'Aggiornamento in corso...' },
  empty: { title: 'Nessun elemento disponibile' }, 'filtered-empty': { title: 'Nessun risultato', description: 'Prova a modificare i filtri.' },
  denied: { title: 'Accesso non disponibile', description: 'Non hai i permessi per visualizzare questo contenuto.' },
  offline: { title: 'Sei offline', description: 'Controlla la connessione e riprova.' }, error: { title: 'Si è verificato un errore' }, success: { title: 'Operazione completata' },
}

export function FeedbackState({ variant, title, description, action, className }: FeedbackStateProps) {
  const copy = DEFAULT_COPY[variant]
  const isLoading = variant === 'loading' || variant === 'refreshing'
  const isAlert = variant === 'error' || variant === 'denied'
  return <div className={cn('cs-feedback-state', `cs-feedback-state--${variant}`, className)} role={isLoading ? 'status' : isAlert ? 'alert' : undefined} aria-live={isLoading || variant === 'success' ? 'polite' : undefined} aria-busy={isLoading || undefined}>
    {isLoading ? <span className="cs-feedback-state__spinner" aria-hidden="true" /> : null}
    <div className="cs-feedback-state__body"><p className="cs-feedback-state__title">{title ?? copy.title}</p>{description ?? copy.description ? <p className="cs-feedback-state__description">{description ?? copy.description}</p> : null}{action ? <div className="cs-feedback-state__action">{action}</div> : null}</div>
  </div>
}

export function LoadingState({ label = 'Caricamento in corso...', refreshing = false }: { label?: string; refreshing?: boolean }) { return <FeedbackState variant={refreshing ? 'refreshing' : 'loading'} title={label} /> }
type ContentFeedbackProps = Omit<FeedbackStateProps, 'variant'>
export function EmptyState({ filtered = false, className, ...props }: ContentFeedbackProps & { filtered?: boolean }) {
  return <FeedbackState variant={filtered ? 'filtered-empty' : 'empty'} className={cn('cs-card py-12 text-center', className)} {...props} />
}
export function ErrorState({ title = 'Si è verificato un errore', className, ...props }: ContentFeedbackProps) {
  return <FeedbackState variant="error" title={title} className={cn('cs-card py-8 text-center', className)} {...props} />
}
export function DeniedState(props: ContentFeedbackProps) { return <FeedbackState variant="denied" {...props} /> }
export function OfflineState(props: ContentFeedbackProps) { return <FeedbackState variant="offline" {...props} /> }
export function SuccessState(props: ContentFeedbackProps) { return <FeedbackState variant="success" {...props} /> }
