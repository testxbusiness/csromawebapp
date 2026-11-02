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

  const original = hint.originalException
  if (original instanceof Error && (
    original.name === 'AbortError' || original.name === 'AuthRetryableFetchError' ||
    /failed to fetch|fetch failed|network error|network request failed|connection (?:refused|reset|timed out)|load failed/i.test(original.message)
  )) return true

  const status = getStatus(hint.originalException)
  if (status !== null && status >= 400 && status < 500) return true

  // PostgREST instrumentation wraps returned errors in a plain Error and keeps
  // the SQLSTATE in `code`, so the HTTP status may no longer be available.
  const code = hint.originalException && typeof hint.originalException === 'object'
    ? (hint.originalException as { code?: unknown }).code
    : undefined
  return typeof code === 'string' && (
    code === 'P0001' || code === '23514' || code === '23505' || code === 'PGRST116' ||
    code === 'PGRST301' || code === '42501' || code.startsWith('22') || code.startsWith('23')
  )
}

/** Remove request, identity and free-form payloads before events leave the app. */
export function sanitizeSentryEvent(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  if (isExpectedSupabaseClientFailure(event, hint)) return null

  event.user = undefined
  event.request = undefined
  event.server_name = undefined
  event.extra = undefined
  const allowedTags = new Set(['feature', 'operation', 'runtime', 'status_class'])
  const allowedValues: Record<string, Set<string>> = {
    feature: new Set(['auth', 'absence', 'messages', 'convocations']),
    operation: new Set(['login', 'reset_password', 'read', 'create', 'revoke', 'update', 'delete']),
    runtime: new Set(['server', 'client']),
    status_class: new Set(['4xx', '5xx']),
  }
  event.tags = event.tags
    ? Object.fromEntries(Object.entries(event.tags).filter(([key, value]) =>
        allowedTags.has(key) && typeof value === 'string' && allowedValues[key]?.has(value),
      ))
    : undefined
  event.breadcrumbs = []
  const trace = event.contexts?.trace
  event.contexts = trace
    ? {
        trace: {
          trace_id: trace.trace_id,
          span_id: trace.span_id,
          ...(trace.parent_span_id ? { parent_span_id: trace.parent_span_id } : {}),
          ...(trace.op ? { op: trace.op } : {}),
          ...(trace.status ? { status: trace.status } : {}),
          ...(trace.origin ? { origin: trace.origin } : {}),
        },
      }
    : undefined

  if (event.message) event.message = 'Application error'
  event.transaction = undefined
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      type: 'Error',
      value: 'Application error',
      mechanism: exception.mechanism
        ? { type: exception.mechanism.type, handled: exception.mechanism.handled }
        : undefined,
      stacktrace: exception.stacktrace
        ? {
            ...exception.stacktrace,
            frames: exception.stacktrace.frames?.map((frame) => ({
              ...frame,
              vars: undefined,
              pre_context: undefined,
              context_line: undefined,
              post_context: undefined,
              abs_path: undefined,
            })),
          }
        : undefined,
    }))
  }

  return event
}
