import { render, screen } from '@testing-library/react'
import { EventKindBadge } from './EventKindBadge'

describe('EventKindBadge', () => {
  it.each([
    ['training', 'Allenamento', 'cs-event-kind--training'],
    ['match', 'Partita', 'cs-event-kind--match'],
    ['meeting', 'Riunione', 'cs-event-kind--meeting'],
    ['other', 'Altro', 'cs-event-kind--other'],
  ])('renders the shared visual contract for %s', (kind, label, modifier) => {
    render(<EventKindBadge kind={kind} />)

    const badge = screen.getByLabelText(`Tipo evento: ${label}`)
    expect(badge).toHaveClass('cs-event-kind', modifier)
    expect(badge).toHaveTextContent(label)
  })

  it('does not classify unknown or missing kinds as a supported category', () => {
    const { rerender } = render(<EventKindBadge kind="legacy-kind" />)

    expect(screen.getByLabelText('Tipo evento non disponibile')).toHaveTextContent('N/D')
    expect(screen.getByLabelText('Tipo evento non disponibile')).not.toHaveClass('cs-event-kind')

    rerender(<EventKindBadge kind={null} />)
    expect(screen.queryByLabelText('Tipo evento non disponibile')).toBeNull()
  })
})
