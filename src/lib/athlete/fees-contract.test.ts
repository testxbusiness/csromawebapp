import { buildAthleteFeesContract } from './fees-contract'

const fee = { id: 'fee-1', team_id: 'team-1', name: 'Quota U16' }
const team = { id: 'team-1', name: 'U16', code: 'U16', activity_id: 'activity-1' }
const activity = { id: 'activity-1', name: 'Basket' }

describe('athlete fees contract', () => {
  it('adds stable team/activity IDs and coherent full-payment amounts', () => {
    const [installment] = buildAthleteFeesContract(
      [{ id: 'i-1', installment_number: 1, due_date: '2026-09-01', amount: 100, status: 'paid', paid_at: '2026-08-20T10:00:00Z', membership_fee_id: 'fee-1' }],
      new Map([[fee.id, fee]]), new Map([[team.id, team]]), new Map([[activity.id, activity]]),
      new Date('2026-08-29T12:00:00Z'),
    ).installments

    expect(installment.membership_fee.team).toEqual({ id: 'team-1', name: 'U16', code: 'U16', activity })
    expect(installment.membership_fee.activity_id).toBe('activity-1')
    expect(installment.financials).toEqual({ due_amount: 100, paid_amount: 100, remaining_amount: 0 })
  })

  it('maps legacy pending to a date-based status and preserves unknown partial amounts', () => {
    const [installment] = buildAthleteFeesContract(
      [{ id: 'i-2', installment_number: 2, due_date: '2026-09-10', amount: 80, status: 'pending', membership_fee_id: 'fee-1' }],
      new Map([[fee.id, fee]]), new Map([[team.id, team]]), new Map([[activity.id, activity]]),
      new Date('2026-08-29T12:00:00Z'),
    ).installments

    expect(installment.status).toBe('due_soon')
    expect(installment.amount).toBe(80)
    expect(installment.financials).toEqual({ due_amount: 80, paid_amount: 0, remaining_amount: 80 })
  })

  it('supports every financial status and computes a known partial payment', () => {
    const statuses = ['not_due', 'due_soon', 'overdue', 'paid', 'partially_paid'] as const
    const installments = statuses.map((status, index) => ({
      id: `i-${index}`,
      installment_number: index + 1,
      due_date: '2026-12-01',
      amount: 100,
      status,
      paid_amount: status === 'partially_paid' ? 25 : undefined,
      membership_fee_id: 'fee-1',
    }))

    const result = buildAthleteFeesContract(
      installments,
      new Map([[fee.id, fee]]), new Map([[team.id, team]]), new Map([[activity.id, activity]]),
      new Date('2026-08-29T12:00:00Z'),
    ).installments

    expect(result.map((item) => item.status)).toEqual(statuses)
    expect(result.find((item) => item.status === 'partially_paid')?.financials).toEqual({
      due_amount: 100,
      paid_amount: 25,
      remaining_amount: 75,
    })
  })
})
