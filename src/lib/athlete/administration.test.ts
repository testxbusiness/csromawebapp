import type { AthleteAdministrationContract } from '@/types/athlete-administration'
import type { AthleteFeeInstallment } from '@/types/athlete-fees'
import { isAthleteAdministrationSummaryActionable, selectAthleteAdministrationSummary } from './administration'

function contract(overrides: Partial<AthleteAdministrationContract> = {}): AthleteAdministrationContract {
  return {
    enrollment_application: { delivered: false },
    medical_certificate: { status: 'expiring', expires_at: '2026-10-20' },
    fees: { installments: [] },
    ...overrides,
  }
}

const overdueInstallment: AthleteFeeInstallment = {
  id: 'installment-1',
  installment_number: 1,
  due_date: '2026-09-01',
  amount: 100,
  status: 'overdue',
  financials: { due_amount: 100, paid_amount: 0, remaining_amount: 100 },
  membership_fee: {
    id: 'fee-1',
    name: 'Quota annuale',
    total_amount: 100,
    enrollment_fee: 0,
    insurance_fee: 0,
    monthly_fee: 100,
    months_count: 1,
    installments_count: 1,
    team_id: 'team-1',
    activity_id: 'activity-1',
    team: { id: 'team-1', name: 'U16', code: 'U16', activity: { id: 'activity-1', name: 'Volley' } },
  },
}

describe('selectAthleteAdministrationSummary', () => {
  it('keeps authorized sections and semantic statuses distinct', () => {
    const summary = selectAthleteAdministrationSummary(contract({
      medical_certificate: { status: 'expired', expires_at: '2026-09-30' },
      fees: {
        installments: [overdueInstallment],
      },
    }))

    expect(summary).toEqual([
      expect.objectContaining({ kind: 'certificate', status: 'expired' }),
      expect.objectContaining({ kind: 'enrollment', status: 'missing' }),
      expect.objectContaining({ kind: 'fees', status: 'overdue' }),
    ])
    expect(summary.every(isAthleteAdministrationSummaryActionable)).toBe(true)
  })

  it('does not turn unauthorized sections into empty or valid states', () => {
    const summary = selectAthleteAdministrationSummary(contract({
      enrollment_application: null,
      medical_certificate: null,
      fees: null,
    }))

    expect(summary).toEqual([])
  })

  it('keeps valid, complete and empty authorized states non-actionable', () => {
    const summary = selectAthleteAdministrationSummary(contract({
      enrollment_application: { delivered: true },
      medical_certificate: { status: 'valid', expires_at: '2027-12-31' },
      fees: { installments: [] },
    }))

    expect(summary.map((item) => item.status)).toEqual(['valid', 'complete', 'empty'])
    expect(summary.filter(isAthleteAdministrationSummaryActionable)).toEqual([])
  })
})
