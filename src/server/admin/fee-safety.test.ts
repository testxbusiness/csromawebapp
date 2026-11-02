import { diagnoseFeeInstallments, hasPaymentEvidence, type FeeInstallmentSafetyRow } from './fee-safety'

const row = (overrides: Partial<FeeInstallmentSafetyRow> = {}): FeeInstallmentSafetyRow => ({
  id: 'row-1', profile_id: 'athlete-1', membership_fee_id: 'plan-a', installment_number: 1,
  amount: 100, due_date: '2026-10-01', status: 'paid', paid_at: '2026-10-02T10:00:00Z',
  activity_id: 'activity-a', season_id: 'season-a', ...overrides,
})

describe('financial safety diagnostics', () => {
  it('treats status, timestamp, actor and payment source as payment evidence', () => {
    expect(hasPaymentEvidence(row())).toBe(true)
    expect(hasPaymentEvidence(row({ status: 'overdue', paid_at: null, paid_by_auth_user_id: 'admin' }))).toBe(true)
    expect(hasPaymentEvidence(row({ status: 'overdue', paid_at: null, paid_by_auth_user_id: null, payment_source: 'admin' }))).toBe(true)
    expect(hasPaymentEvidence(row({ status: 'overdue', paid_at: null, paid_by_auth_user_id: null, payment_source: null }))).toBe(false)
  })

  it('distinguishes duplicate rows under one plan from distinct issued plans and reports paid_at/status mismatch read-only', () => {
    const rows = [
      row(),
      row({ id: 'row-2', status: 'overdue' }),
      row({ id: 'row-3', membership_fee_id: 'plan-b' }),
    ]
    const report = diagnoseFeeInstallments(rows)
    expect(report.mismatches).toEqual([{ id: 'row-2', status: 'overdue', paid_at: '2026-10-02T10:00:00Z' }])
    expect(report.duplicateGroups).toEqual([
      { key: 'athlete-1:activity-a:season-a', installmentIds: ['row-1', 'row-2', 'row-3'], planIds: ['plan-a', 'plan-b'], kind: 'multiple_issued_plans' },
    ])
    expect(rows[1].status).toBe('overdue')
    expect(rows).toHaveLength(3)
  })
})
