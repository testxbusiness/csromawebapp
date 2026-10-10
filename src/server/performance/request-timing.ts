import 'server-only'

type TimingEntry = {
  name: string
  durationMs: number
}

type TimingDetail = {
  name: string
  value: number | string | boolean | null
}

export type RequestTiming = {
  requestId: string
  route: string
  mark: (name: string, startedAt: number) => void
  detail: (name: string, value: number | string | boolean | null) => void
  now: () => number
  finish: <T extends Response>(response: T) => T
}

const REQUEST_ID_HEADER = 'x-cs-request-id'
export const performanceDiagnosticsEnabled = process.env.PERFORMANCE_DIAGNOSTICS === '1'

function createRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `perf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toMilliseconds(value: number): number {
  return Math.round(value * 100) / 100
}

function toServerTimingName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'phase'
}

export function startRequestTiming(request: Request | undefined, route: string): RequestTiming | null {
  if (!performanceDiagnosticsEnabled) return null

  const requestId = request?.headers?.get(REQUEST_ID_HEADER) || createRequestId()
  const startedAt = performance.now()
  const entries: TimingEntry[] = []
  const details: TimingDetail[] = []

  return {
    requestId,
    route,
    now: () => performance.now(),
    mark(name, phaseStartedAt) {
      entries.push({ name, durationMs: toMilliseconds(performance.now() - phaseStartedAt) })
    },
    detail(name, value) {
      details.push({ name, value })
    },
    finish(response) {
      const totalMs = toMilliseconds(performance.now() - startedAt)
      const serverTiming = [
        ...entries,
        { name: 'route-total', durationMs: totalMs },
      ]
        .map(({ name, durationMs }) => `${toServerTimingName(name)};dur=${durationMs}`)
        .join(', ')

      const headers = (response as Response & { headers?: Headers }).headers
      headers?.set(REQUEST_ID_HEADER, requestId)
      headers?.set('Server-Timing', serverTiming)
      console.warn(JSON.stringify({
        type: 'performance-diagnostic',
        route,
        requestId,
        durationMs: totalMs,
        phases: serverTiming,
        details,
      }))
      return response
    },
  }
}

export function finishRequestResponse<T extends Response>(response: T, timing: RequestTiming | null): T {
  return timing ? timing.finish(response) : response
}

export const performanceDiagnosticHeaders = {
  requestId: REQUEST_ID_HEADER,
}
