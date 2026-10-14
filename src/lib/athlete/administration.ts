import { useQuery } from '@tanstack/react-query'
import { appendSubjectProfile, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { athleteKeys } from '@/lib/query-keys'
import type { AthleteAdministrationContract } from '@/types/athlete-administration'
import type { AthleteFeeStatus } from '@/types/athlete-fees'
import { markAthleteQueryParsed, markAthleteQueryResponse, markAthleteQueryStart } from '@/lib/performance/athlete-first-load'
import { athleteQueryPolicy } from '@/lib/athlete/query-policy'

const ATHLETE_ADMINISTRATION_STALE_TIME = athleteQueryPolicy.administration.staleTime

export type AthleteAdministrationSummaryItem =
  | {
      kind: 'certificate'
      status: 'valid' | 'missing' | 'expired' | 'expiring'
      label: string
      href: '/athlete/fees?section=certificate'
    }
  | {
      kind: 'enrollment'
      status: 'complete' | 'missing'
      label: string
      href: '/athlete/fees?section=enrollment'
    }
  | {
      kind: 'fees'
      status: 'empty' | 'pending' | 'due_soon' | 'overdue' | 'paid'
      label: string
      href: '/athlete/fees?section=fees'
    }

const FEE_ATTENTION_STATUSES: AthleteFeeStatus[] = ['overdue', 'due_soon', 'partially_paid', 'not_due']
type FeesSummaryStatus = Extract<AthleteAdministrationSummaryItem, { kind: 'fees' }>['status']

function getFeesSummaryStatus(contract: AthleteAdministrationContract['fees']): FeesSummaryStatus {
  if (!contract || contract.installments.length === 0) return 'empty'
  if (contract.installments.some((installment) => installment.status === 'overdue')) return 'overdue'
  if (contract.installments.some((installment) => installment.status === 'due_soon')) return 'due_soon'
  if (contract.installments.some((installment) => FEE_ATTENTION_STATUSES.includes(installment.status))) return 'pending'
  return 'paid'
}

/**
 * Selects only data already authorized by the Administration contract.
 * A null section means that section was not exposed by server-side permissions;
 * it must not be rendered as an empty or valid state in Profile.
 */
export function selectAthleteAdministrationSummary(
  contract: AthleteAdministrationContract,
): AthleteAdministrationSummaryItem[] {
  const summary: AthleteAdministrationSummaryItem[] = []

  if (contract.medical_certificate) {
    const { status } = contract.medical_certificate
    summary.push({
      kind: 'certificate',
      status,
      label: status === 'valid' ? 'Certificato medico valido' : status === 'missing' ? 'Certificato medico da consegnare' : status === 'expired' ? 'Certificato medico scaduto' : 'Certificato medico in scadenza',
      href: '/athlete/fees?section=certificate',
    })
  }

  if (contract.enrollment_application) {
    summary.push({
      kind: 'enrollment',
      status: contract.enrollment_application.delivered ? 'complete' : 'missing',
      label: contract.enrollment_application.delivered ? 'Domanda di iscrizione consegnata' : 'Domanda di iscrizione da consegnare',
      href: '/athlete/fees?section=enrollment',
    })
  }

  if (contract.fees) {
    const status = getFeesSummaryStatus(contract.fees)
    summary.push({
      kind: 'fees',
      status,
      label: status === 'overdue' ? 'Quote associative scadute' : status === 'due_soon' ? 'Quote associative in scadenza' : status === 'pending' ? 'Quote associative da completare' : status === 'paid' ? 'Quote associative saldate' : 'Nessuna quota associativa',
      href: '/athlete/fees?section=fees',
    })
  }

  return summary
}

export function isAthleteAdministrationSummaryActionable(item: AthleteAdministrationSummaryItem): boolean {
  return item.status === 'missing' || item.status === 'expired' || item.status === 'expiring' || item.status === 'overdue' || item.status === 'due_soon' || item.status === 'pending'
}

export class AthleteAdministrationQueryError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AthleteAdministrationQueryError'
    this.status = status
  }
}

async function fetchAthleteAdministration(subjectProfileId: string | null): Promise<AthleteAdministrationContract> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new AthleteAdministrationQueryError('offline')
  const requestStartedAt = markAthleteQueryStart('administration', 'administration')
  const response = await fetch(appendSubjectProfile('/api/athlete/administration', subjectProfileId), { cache: 'no-store' })
  markAthleteQueryResponse('administration', 'administration', requestStartedAt, response)
  if (!response.ok) throw new AthleteAdministrationQueryError(response.status === 403 ? 'denied' : 'administration_fetch_failed', response.status)
  const payload = await response.json() as AthleteAdministrationContract
  markAthleteQueryParsed('administration', 'administration', requestStartedAt)
  return payload as AthleteAdministrationContract
}

export function useAthleteAdministrationQuery() {
  const { account, role, user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const accountId = account?.authUserId ?? null
  const subjectProfileId = selectedProfileId ?? account?.ownerProfileId ?? null
  const isFamilyView = activeArea === 'family'
  const enabled = Boolean(!authLoading && !profileLoading && user && accountId && subjectProfileId && (role === 'athlete' || role === 'family_member') && (!isFamilyView || selectedProfileId))
  const queryKey = accountId && subjectProfileId ? athleteKeys.administration(accountId, subjectProfileId) : athleteKeys.administration('anonymous', 'unavailable')
  const query = useQuery({
    queryKey,
    queryFn: () => fetchAthleteAdministration(isFamilyView ? selectedProfileId : null),
    enabled,
    retry: false,
    ...athleteQueryPolicy.administration,
  })
  return { ...query, enabled }
}
