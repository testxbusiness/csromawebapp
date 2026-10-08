'use client'

import { useEffect } from 'react'

type AthletePage = 'dashboard' | 'calendar' | 'messages' | 'administration' | 'profile'

const diagnosticsEnabled = process.env.NEXT_PUBLIC_PERFORMANCE_DIAGNOSTICS === '1'
const pageMounts = new Map<AthletePage, number>()

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function emit(event: Record<string, unknown>) {
  if (!diagnosticsEnabled || typeof window === 'undefined') return
  console.warn(JSON.stringify({ type: 'performance-diagnostic-client', ...event }))
}

export function useAthleteFirstLoadDiagnostics(
  page: AthletePage,
  queryEnabled: boolean,
  hasData: boolean,
) {
  useEffect(() => {
    const mountedAt = performance.now()
    pageMounts.set(page, mountedAt)
    emit({ page, phase: 'page-mount' })
  }, [page])

  useEffect(() => {
    if (!queryEnabled) return
    emit({
      page,
      phase: 'query-enabled',
      preRequestWaitMs: pageMounts.has(page) ? round(performance.now() - (pageMounts.get(page) ?? performance.now())) : null,
    })
  }, [page, queryEnabled])

  useEffect(() => {
    if (!hasData) return
    const mountAt = pageMounts.get(page)
    emit({
      page,
      phase: 'first-useful-render',
      pageToUsefulRenderMs: mountAt === undefined ? null : round(performance.now() - mountAt),
    })
  }, [hasData, page])
}

export function markAthleteQueryStart(page: AthletePage, query: string): number {
  const startedAt = performance.now()
  const mountAt = pageMounts.get(page)
  emit({
    page,
    query,
    phase: 'query-fetch-start',
    preRequestWaitMs: mountAt === undefined ? null : round(startedAt - mountAt),
  })
  return startedAt
}

export function markAthleteQueryResponse(
  page: AthletePage,
  query: string,
  requestStartedAt: number,
  response: Response,
) {
  const contentLengthHeader = typeof response.headers?.get === 'function'
    ? response.headers.get('content-length')
    : null
  emit({
    page,
    query,
    phase: 'response-received',
    requestMs: round(performance.now() - requestStartedAt),
    contentLengthBytes: contentLengthHeader ? Number(contentLengthHeader) : null,
  })
}

export function markAthleteQueryParsed(page: AthletePage, query: string, requestStartedAt: number) {
  emit({
    page,
    query,
    phase: 'response-parsed',
    totalClientRequestMs: round(performance.now() - requestStartedAt),
  })
}

export function markAccessibleProfilesFetchStart(source: 'initial-effect' | 'focus-visibility'): number {
  const startedAt = performance.now()
  emit({ phase: 'accessible-profiles-fetch-start', source })
  return startedAt
}

export function markAccessibleProfilesFetchEnd(
  source: 'initial-effect' | 'focus-visibility',
  startedAt: number,
  response: Response,
) {
  emit({
    phase: 'accessible-profiles-response',
    source,
    durationMs: round(performance.now() - startedAt),
    status: response.status,
  })
}
