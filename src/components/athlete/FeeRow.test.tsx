import { fireEvent, render, screen } from '@testing-library/react'
import type { AthleteFeeInstallment } from '@/types/athlete-fees'
import { FeeRow } from './FeeRow'

const installment: AthleteFeeInstallment = {
  id: 'installment-1', installment_number: 1, due_date: '2026-09-10', amount: 120, status: 'due_soon',
  financials: { due_amount: 120, paid_amount: 0, remaining_amount: 120 },
  membership_fee: {
    id: 'fee-1', name: 'Quota annuale', total_amount: 120, enrollment_fee: 20, insurance_fee: 10,
    monthly_fee: 9, months_count: 10, installments_count: 1, team_id: 'team-1', activity_id: 'activity-1',
    team: { id: 'team-1', name: 'U16', code: 'U16-E', activity: { id: 'activity-1', name: 'Volley' } },
  },
}

describe('FeeRow', () => {
  it('renders compact context and expands the financial breakdown', () => {
    render(<FeeRow installment={installment} />)
    const row = screen.getByRole('button', { name: /Quota annuale.*Rata 1/i })
    expect(screen.queryByText('U16')).toBeNull()
    expect(screen.getByText('In scadenza')).toBeTruthy()
    fireEvent.click(row)
    expect(screen.getByText('Volley')).toBeTruthy()
    expect(screen.getByText('Importo dovuto')).toBeTruthy()
    expect(row.getAttribute('aria-expanded')).toBe('true')
  })

  it('shows an explicit dash when a partial paid amount is unavailable', () => {
    render(<FeeRow installment={{ ...installment, status: 'partially_paid', financials: { due_amount: 120, paid_amount: null, remaining_amount: null } }} />)
    fireEvent.click(screen.getByRole('button', { name: /Quota annuale.*Rata 1/i }))
    expect(screen.getByText('Parziale')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
