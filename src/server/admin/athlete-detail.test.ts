import { summarizeAthletePlans, type AthleteDetailPlan } from './athlete-detail'

const plan = (id: string, activityId: string, installments: AthleteDetailPlan['installments']): AthleteDetailPlan => ({
  id, name: `Piano ${id}`, teamId: `team-${id}`, teamName: `Team ${id}`,
  activityId, activityName: `Attività ${activityId}`, installments,
})

describe('summarizeAthletePlans', () => {
  it('counts emitted installments once and treats paid status as paid only with payment evidence', () => {
    const result = summarizeAthletePlans([
      plan('one', 'basket', [
        { id: '1', installment_number: 1, due_date: '2026-09-01', amount: 100, status: 'paid', paid_at: '2026-09-01' },
        { id: '2', installment_number: 2, due_date: '2026-10-01', amount: 100, status: 'partially_paid', paid_at: null },
      ]),
    ])
    expect(result).toEqual({ totalDue: 200, totalPaid: 100, remaining: 100, hasMultiplePlansPerActivity: false })
  })

  it('flags multiple emitted plans for one activity without merging or removing their installments', () => {
    const result = summarizeAthletePlans([
      plan('one', 'basket', [{ id: '1', installment_number: 1, due_date: '2026-09-01', amount: 100, status: 'paid', paid_at: '2026-09-01' }]),
      plan('two', 'basket', [{ id: '2', installment_number: 1, due_date: '2026-09-01', amount: 120, status: 'not_due', paid_at: null }]),
      plan('three', 'swim', [{ id: '3', installment_number: 1, due_date: '2026-09-01', amount: 80, status: 'not_due', paid_at: null }]),
    ])
    expect(result).toEqual({ totalDue: 300, totalPaid: 100, remaining: 200, hasMultiplePlansPerActivity: true })
  })
})
