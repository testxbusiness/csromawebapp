import type { ErrorEvent, EventHint } from '@sentry/nextjs'

type StatusError = {
  status?: unknown
  statusCode?: unknown
  response?: { status?: unknown }
}

function getStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null
  const candidate = error as StatusError
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status
  return typeof status === 'number' ? status : null
}

function isExpectedSupabaseClientFailure(event: ErrorEvent, hint: EventHint): boolean {
  const isSupabaseError = event.exception?.values?.some(
    (exception) => exception.mechanism?.type?.startsWith('auto.db.supabase.'),
  )

  if (!isSupabaseError) return false

  const status = getStatus(hint.originalException)
  return status !== null && status >= 400 && status < 500 && status !== 429
}

/** Remove request, identity and free-form payloads before events leave the app. */
export function sanitizeSentryEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isExpectedSupabaseClientFailure(event, hint)) return null

  event.user = undefined
  event.request = undefined
  event.extra = undefined
  event.tags = undefined
  event.breadcrumbs = []
  event.contexts = event.contexts?.trace ? { trace: event.contexts.trace } : undefined

  if (event.message) event.message = 'Application error'
  event.transaction = undefined
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.type ?? 'Application error',
      mechanism: exception.mechanism
        ? { type: exception.mechanism.type, handled: exception.mechanism.handled }
        : undefined,
    }))
  }

  return event
}
