import { fireEvent, render, screen } from '@testing-library/react'
import EventDetailModal from './EventDetailModal'

describe('EventDetailModal', () => {
  it('renders an accessible loading state while the detail is being fetched', () => {
    render(<EventDetailModal open onClose={() => undefined} data={null} />)

    expect(screen.getByText('Caricamento evento...')).toBeTruthy()
  })

  it('renders the available event metadata inside an accessible responsive detail', () => {
    render(
      <EventDetailModal
        open
        onClose={() => undefined}
        data={{
          title: 'Allenamento U16',
          event_kind: 'training',
          start_date: '2026-08-29T18:00:00+02:00',
          end_date: '2026-08-29T20:00:00+02:00',
          location: 'Palestra CSRoma',
          teams: [{ id: 'team-1', name: 'U16', code: 'U16' }],
          description: 'Portare la divisa chiara.',
          creator: { first_name: 'Marco', last_name: 'Rossi' },
        }}
      />,
    )

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Dettaglio evento Allenamento U16/i })).toBeTruthy()
    expect(screen.getByText('Allenamento')).toBeTruthy()
    expect(screen.getByText('Palestra CSRoma')).toBeTruthy()
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText('Portare la divisa chiara.')).toBeTruthy()
    expect(screen.getByText('Marco Rossi')).toBeTruthy()
  })

  it('delegates close to the parent through the ResponsiveDetail close control', () => {
    const onClose = jest.fn()
    render(<EventDetailModal open onClose={onClose} data={{ title: 'Evento' }} />)

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders an explicit error state and exposes retry', () => {
    const onRetry = jest.fn()
    render(
      <EventDetailModal
        open
        onClose={() => undefined}
        data={null}
        error="Dettaglio non disponibile"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('Dettaglio non disponibile')
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Caricamento evento...')).toBeNull()
  })
})
