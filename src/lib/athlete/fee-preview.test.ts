import { feeStatusLabel, selectMostUrgentFee } from './fee-preview'

describe('fee preview', () => {
  it('prioritizes overdue unpaid fees over earlier non-urgent fees', () => {
    const result = selectMostUrgentFee([
      { id: 'not-due', due_date: '2026-08-20', status: 'not_due' as const },
      { id: 'overdue', due_date: '2026-08-25', status: 'overdue' as const },
      { id: 'paid', due_date: '2026-08-01', status: 'paid' as const },
    ])

    expect(result?.id).toBe('overdue')
  })

  it('returns no preview when every installment is paid', () => {
    expect(selectMostUrgentFee([{ due_date: '2026-08-20', status: 'paid' as const }])).toBeUndefined()
    expect(feeStatusLabel('partially_paid')).toBe('Parzialmente pagata')
  })
})
