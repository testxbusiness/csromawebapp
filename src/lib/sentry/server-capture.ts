import * as Sentry from '@sentry/nextjs'
import { isSdkOwnedError } from './sdk-owned-error'

export type SentryFeature = 'auth' | 'absence' | 'messages' | 'convocations'
export type SentryOperation = 'login' | 'reset_password' | 'read' | 'create' | 'revoke' | 'update' | 'delete'
export type SentryRuntime = 'server' | 'client'

const captured = new WeakSet<object>()
const FEATURES = new Set<SentryFeature>(['auth', 'absence', 'messages', 'convocations'])
const OPERATIONS = new Set<SentryOperation>(['login', 'reset_password', 'read', 'create', 'revoke', 'update', 'delete'])

/** Run a route/client operation in a tagged scope so SDK-owned Supabase events
 * inherit the same static functional tags as manual captures. */
export function withSentryOperation<T extends (...args: never[]) => unknown>(
  feature: SentryFeature,
  operation: SentryOperation,
  handler: T,
): T {
  return ((...args: Parameters<T>) => Sentry.withScope((scope) => {
    scope.setTag('feature', feature)
    scope.setTag('operation', operation)
    scope.setTag('runtime', typeof window === 'undefined' ? 'server' : 'client')
    return handler(...args)
  })) as T
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const item = error as { status?: unknown; statusCode?: unknown; code?: unknown; response?: { status?: unknown } }
  const status = item.status ?? item.statusCode ?? item.response?.status
  if (typeof status === 'number') return status
  if (typeof item.code === 'string') {
    if (item.code === 'PGRST301' || item.code === '42501') return 403
    if (item.code.startsWith('22') || item.code.startsWith('23') || item.code === 'PGRST116') return 400
  }
  return undefined
}

export function isExpectedOperationalError(error: unknown): boolean {
  const status = statusOf(error)
  if (status !== undefined && status < 500) return true
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown }
    const code = candidate.code
    if (typeof candidate.message === 'string' && /failed to fetch|fetch failed|network error|network request failed|connection (?:refused|reset|timed out)|load failed/i.test(candidate.message)) return true
    if (typeof code === 'string' && (code === 'P0001' || code === '23514' || code === '23505' || code === 'PGRST116')) return true
    if (typeof code === 'string' && /^(ECONN|ENET|EAI_AGAIN|ETIMEDOUT|UND_ERR)/.test(code)) return true
  }
  if (error instanceof TypeError && /fetch|network|failed to connect|load failed/i.test(error.message)) return true
  if (error instanceof Error && error.name === 'AbortError') return true
  return false
}

/** Capture one sanitized operational issue. Only static allowlisted tags leave the process. */
export function captureUnexpectedServerError(
  error: unknown,
  feature: SentryFeature,
  operation: SentryOperation,
  runtime: SentryRuntime = 'server',
): void {
  if (!FEATURES.has(feature) || !OPERATIONS.has(operation) || isExpectedOperationalError(error)) return
  if (isSdkOwnedError(error)) return
  if (error && typeof error === 'object') {
    if (captured.has(error)) return
    captured.add(error)
  }
  const safeError = new Error(`Unexpected ${feature} operation failure`)
  if (error instanceof Error && error.stack) safeError.stack = error.stack
  Sentry.withScope((scope) => {
    scope.setTag('feature', feature)
    scope.setTag('operation', operation)
    scope.setTag('runtime', runtime)
    const status = statusOf(error)
    if (status !== undefined) scope.setTag('status_class', status >= 500 ? '5xx' : '4xx')
    // Keep Sentry's default grouping, which can use the original stack. A
    // feature/operation-only fingerprint merges unrelated technical failures.
    Sentry.captureException(safeError)
  })
}

/** Capture an uninstrumented Supabase error without forwarding its raw text. */
export function captureSupabaseError(
  error: unknown,
  feature: SentryFeature,
  operation: SentryOperation,
  runtime: SentryRuntime,
  sdkInstrumented: boolean,
): void {
  // Resolved errors from instrumented PostgREST/Auth calls are already sent by
  // the SDK before the `{ error }` result reaches application code.
  if (sdkInstrumented) return
  captureUnexpectedServerError(error, feature, operation, runtime)
}
