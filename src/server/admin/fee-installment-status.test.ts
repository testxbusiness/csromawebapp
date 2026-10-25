import { getUnpaidInstallmentStatus } from './fee-installment-status'

describe('getUnpaidInstallmentStatus', () => {
  const now = new Date('2026-10-25T12:00:00.000Z')

  it('marks due dates today or in the past as overdue', () => {
    expect(getUnpaidInstallmentStatus('2026-10-25', now)).toBe('overdue')
    expect(getUnpaidInstallmentStatus('2026-10-24', now)).toBe('overdue')
  })

  it('marks due dates within the next 30 days as due soon', () => {
    expect(getUnpaidInstallmentStatus('2026-10-26', now)).toBe('due_soon')
    expect(getUnpaidInstallmentStatus('2026-11-24', now)).toBe('due_soon')
  })

  it('marks later due dates as not due', () => {
    expect(getUnpaidInstallmentStatus('2026-11-25', now)).toBe('not_due')
  })
})
