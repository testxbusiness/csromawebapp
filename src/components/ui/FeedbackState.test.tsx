import { fireEvent, render, screen } from '@testing-library/react'
import { FeedbackState } from './FeedbackState'

describe('FeedbackState', () => {
  it.each([
    ['loading', 'Caricamento'],
    ['refreshing', 'Aggiornamento'],
    ['empty', 'Vuoto'],
    ['offline', 'Offline'],
    ['denied', 'Negato'],
  ] as const)('renders the %s state with explicit copy', (variant, title) => {
    render(<FeedbackState variant={variant} title={title} description="Dettaglio stato" />)

    expect(screen.getByText(title)).toBeTruthy()
    expect(screen.getByText('Dettaglio stato')).toBeTruthy()
  })

  it('exposes errors as alerts and supports a retry action', () => {
    const retry = jest.fn()
    render(
      <FeedbackState
        variant="error"
        title="Dashboard non disponibile"
        action={<button type="button" onClick={retry}>Riprova</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toContain('Dashboard non disponibile')
  })
})
