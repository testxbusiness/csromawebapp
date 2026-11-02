import baseline from './fixtures/admin-financial-staging-baseline-2026-10-14.json'

describe('admin financial staging safety baseline', () => {
  it('keeps the captured staging baseline internally consistent', () => {
    expect(baseline.project).toBe('csromawebapp-staging')
    expect(baseline.projectRef).toBe('kibtvkuiedoxgppnnxkf')
    expect(baseline.counts.feeInstallments).toBe(baseline.feeInstallments.statuses.not_due + baseline.feeInstallments.statuses.overdue + baseline.feeInstallments.statuses.paid)
    expect(baseline.feeInstallments.scheduledAmount).toBe(baseline.feeInstallments.paidAmount + baseline.feeInstallments.unpaidAmount)
    expect(baseline.feeInstallments.templateMismatches).toBe(0)
  })

  it('has no observed referential or payment-state anomalies in the captured snapshot', () => {
    const observedAnomalies = Object.entries(baseline.anomalies)
      .filter(([name]) => name !== 'monitoredNotDueInstallments')

    for (const [, count] of observedAnomalies) {
      expect(count).toBe(0)
    }
  })

  it('keeps the monitored not-due state explicit instead of treating it as an error', () => {
    expect(baseline.anomalies.monitoredNotDueInstallments).toBe(5)
    expect(baseline.feeInstallments.statuses.not_due).toBe(5)
  })

  it.todo('run the same invariants against a live staging read-only connection')
  it.todo('verify paid-installment history survives fee-plan edits and deletes')
  it.todo('verify a fee plan cannot be assigned to an athlete outside its team')
  it.todo('verify receipt upload creates a linked financial document atomically')
})
