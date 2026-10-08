import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteDashboardAdministrativeAlert, AthleteDashboardContract } from '@/types/athlete-dashboard'
import { markAthleteQueryParsed, markAthleteQueryResponse, markAthleteQueryStart } from '@/lib/performance/athlete-first-load'

export const ATHLETE_DASHBOARD_STALE_TIME = 90 * 1000
export const ATHLETE_DASHBOARD_ALERTS_STALE_TIME = 3 * 60 * 1000

export class AthleteDashboardQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteDashboardQueryError'
    this.status = status
  }
}

type DashboardAlertsResponse = { administrativeAlerts?: AthleteDashboardAdministrativeAlert[]; error?: string }

async function fetchDashboard(
  subjectProfileId: string | null,
  signal: AbortSignal,
): Promise<AthleteDashboardContract> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteDashboardQueryError('offline')
  }
  const requestStartedAt = markAthleteQueryStart('dashboard', 'dashboard')
  const response = await fetch(appendSubjectProfile('/api/athlete/dashboard', subjectProfileId), {
    cache: 'no-store',
    signal,
  })
  markAthleteQueryResponse('dashboard', 'dashboard', requestStartedAt, response)
  const payload = await response.json().catch(() => null) as Partial<AthleteDashboardContract> & { error?: string } | null
  markAthleteQueryParsed('dashboard', 'dashboard', requestStartedAt)
  if (!response.ok) {
    throw new AthleteDashboardQueryError(
      response.status === 403 ? 'denied' : response.status === 401 ? 'session_expired' : payload?.error ?? 'dashboard_fetch_failed',
      response.status,
    )
  }
  return {
    teamMemberships: payload?.teamMemberships ?? [],
    upcomingEvents: payload?.upcomingEvents ?? [],
    nextChampionshipMatch: payload?.nextChampionshipMatch ?? null,
    unreadMessages: payload?.unreadMessages ?? [],
    feeInstallments: payload?.feeInstallments ?? [],
    activeSeason: payload?.activeSeason ?? null,
    teams: payload?.teams ?? [],
    unreadMessageCount: payload?.unreadMessageCount ?? 0,
    attendance_availability: payload?.attendance_availability ?? null,
  }
}

async function fetchDashboardAlerts(
  subjectProfileId: string | null,
  signal: AbortSignal,
): Promise<AthleteDashboardAdministrativeAlert[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AthleteDashboardQueryError('offline')
  }
  const requestStartedAt = markAthleteQueryStart('dashboard', 'dashboard-alerts')
  const response = await fetch(appendSubjectProfile('/api/athlete/dashboard/alerts', subjectProfileId), {
    cache: 'no-store',
    signal,
  })
  markAthleteQueryResponse('dashboard', 'dashboard-alerts', requestStartedAt, response)
  const payload = await response.json().catch(() => null) as DashboardAlertsResponse | null
  markAthleteQueryParsed('dashboard', 'dashboard-alerts', requestStartedAt)
  if (!response.ok) {
    throw new AthleteDashboardQueryError(
      response.status === 403 ? 'denied' : response.status === 401 ? 'session_expired' : payload?.error ?? 'dashboard_alerts_fetch_failed',
      response.status,
    )
  }
  return Array.isArray(payload?.administrativeAlerts) ? payload.administrativeAlerts.slice(0, 2) : []
}

function useAthleteDashboardContext() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? user?.id ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const permissions = selectedProfile?.relationship.permissions
  const canAccess = accountId && subjectProfileId && (
    role === 'athlete' ||
    (role === 'family_member' && Boolean(
      permissions?.view_schedule || permissions?.view_payments || permissions?.view_medical_status || permissions?.receive_messages,
    ))
  )
  const enabled = Boolean(!authLoading && !profileLoading && user && canAccess && (!isFamilyView || selectedProfileId))
  return { accountId, subjectProfileId, isFamilyView, enabled }
}

export function useAthleteDashboardQuery() {
  const context = useAthleteDashboardContext()
  const queryKey = context.accountId && context.subjectProfileId
    ? athleteKeys.dashboard(context.accountId, context.subjectProfileId)
    : athleteKeys.dashboard('anonymous', 'unavailable')
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchDashboard(context.isFamilyView ? context.subjectProfileId : null, signal),
    enabled: context.enabled,
    retry: false,
    staleTime: ATHLETE_DASHBOARD_STALE_TIME,
  })
  return { ...query, ...context }
}

export function useAthleteDashboardAlertsQuery() {
  const context = useAthleteDashboardContext()
  const queryKey = context.accountId && context.subjectProfileId
    ? athleteKeys.dashboardAlerts(context.accountId, context.subjectProfileId)
    : athleteKeys.dashboardAlerts('anonymous', 'unavailable')
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchDashboardAlerts(context.isFamilyView ? context.subjectProfileId : null, signal),
    enabled: context.enabled,
    retry: false,
    staleTime: ATHLETE_DASHBOARD_ALERTS_STALE_TIME,
  })
  return { ...query, ...context }
}
