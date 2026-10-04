import { fireEvent, render, screen } from '@testing-library/react'
import { Button } from './Button'
import { StatusBadge } from './StatusBadge'
import { Tabs } from './Tabs'

describe('primitive visual contract', () => {
  it('keeps action variants compatible while exposing canonical athlete actions', () => {
    render(
      <>
        <Button>Conferma</Button>
        <Button variant="secondary">Esporta</Button>
        <Button variant="accent">Compatibilità</Button>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Conferma' })).toHaveClass('cs-btn--primary')
    expect(screen.getByRole('button', { name: 'Esporta' })).toHaveClass('cs-btn--secondary')
    expect(screen.getByRole('button', { name: 'Compatibilità' })).toHaveClass('cs-btn--accent')
  })

  it('renders status semantics with a text label independent of color', () => {
    render(<StatusBadge status="warning" label="Da verificare" />)

    const badge = screen.getByText('Da verificare')
    expect(badge).toBeVisible()
    expect(badge.closest('.cs-status-badge')).toHaveClass('cs-status-badge--warning')
  })

  it('supports keyboard movement for selected segments', () => {
    const onChange = jest.fn()
    render(<Tabs tabs={[{ id: 'month', label: 'Mese' }, { id: 'agenda', label: 'Agenda' }]} onValueChange={onChange} />)

    const month = screen.getByRole('tab', { name: 'Mese' })
    fireEvent.keyDown(month, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith('agenda')
    expect(screen.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true')
  })
})
