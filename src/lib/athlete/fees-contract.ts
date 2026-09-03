import type {
  AthleteFeeInstallment,
  AthleteFeeStatus,
  AthleteFeesContract,
  AthleteFeeTeam,
} from '@/types/athlete-fees'

type RawFeeInstallment = {
  id: string
  installment_number: number
  due_date: string
  amount: number
  status: string | null
  paid_at?: string | null
  membership_fee_id: string
  paid_amount?: number | null
}

type RawMembershipFee = {
  id: string
  team_id: string
  name?: string | null
  description?: string | null
  total_amount?: number | null
  enrollment_fee?: number | null
  insurance_fee?: number | null
  monthly_fee?: number | null
  months_count?: number | null
  installments_count?: number | null
}

type RawTeam = { id: string; name: string; code: string; activity_id?: string | null }
type RawActivity = { id: string; name: string }

function normalizeStatus(row: RawFeeInstallment, now: Date): AthleteFeeStatus {
  if (row.paid_at || row.status === 'paid') return 'paid'
  if (row.status === 'partially_paid') return 'partially_paid'
  if (row.status === 'overdue') return 'overdue'
  if (row.status === 'due_soon') return 'due_soon'
  if (row.status === 'not_due') return 'not_due'

  const dueDate = new Date(`${row.due_date}T00:00:00Z`)
  const dueSoon = new Date(now)
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 30)
  if (dueDate < new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)) return 'overdue'
  if (dueDate <= dueSoon) return 'due_soon'
  return 'not_due'
}

function financials(row: RawFeeInstallment, status: AthleteFeeStatus) {
  const due = Number(row.amount) || 0
  const paid = status === 'paid'
    ? due
    : status === 'partially_paid' && row.paid_amount != null
      ? Math.min(Math.max(Number(row.paid_amount) || 0, 0), due)
      : status === 'partially_paid'
        ? null
        : 0
  return {
    due_amount: due,
    paid_amount: paid,
    remaining_amount: paid == null ? null : Math.max(due - paid, 0),
  }
}

export function buildAthleteFeesContract(
  installments: RawFeeInstallment[],
  fees: Map<string, RawMembershipFee>,
  teams: Map<string, RawTeam>,
  activities: Map<string, RawActivity>,
  now = new Date(),
): AthleteFeesContract {
  return {
    installments: installments.flatMap((row): AthleteFeeInstallment[] => {
      const fee = fees.get(row.membership_fee_id)
      if (!fee) return []
      const team = teams.get(fee.team_id)
      const activity: AthleteFeeTeam['activity'] = team?.activity_id && activities.has(team.activity_id)
        ? { id: team.activity_id, name: activities.get(team.activity_id)?.name ?? 'N/D' }
        : { id: null, name: 'N/D' }
      const resolvedTeam = team ?? { id: fee.team_id, name: 'N/D', code: 'N/D' }
      const status = normalizeStatus(row, now)
      return [{
        id: row.id,
        installment_number: row.installment_number,
        due_date: row.due_date,
        amount: Number(row.amount) || 0,
        status,
        paid_at: row.paid_at || undefined,
        financials: financials(row, status),
        membership_fee: {
          id: fee.id,
          name: fee.name || 'Quota',
          description: fee.description || undefined,
          total_amount: Number(fee.total_amount) || 0,
          enrollment_fee: Number(fee.enrollment_fee) || 0,
          insurance_fee: Number(fee.insurance_fee) || 0,
          monthly_fee: Number(fee.monthly_fee) || 0,
          months_count: Number(fee.months_count) || 0,
          installments_count: Number(fee.installments_count) || 1,
          team_id: resolvedTeam.id,
          activity_id: activity.id,
          team: { id: resolvedTeam.id, name: resolvedTeam.name, code: resolvedTeam.code, activity },
        },
      }]
    }),
  }
}
