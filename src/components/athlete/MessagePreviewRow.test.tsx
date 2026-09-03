import { fireEvent, render, screen } from '@testing-library/react'
import { MessagePreviewRow } from './MessagePreviewRow'

describe('MessagePreviewRow', () => {
  it('shows sender, unread marker and aggregated team context', () => {
    render(
      <MessagePreviewRow
        message={{
          id: 'message-1',
          subject: 'Convocazione',
          content: 'Controlla il calendario',
          is_read: false,
          created_by_profile: { first_name: 'Ada', last_name: 'Rossi' },
          teams: [{ id: 'team-1', name: 'U16' }, { id: 'team-2', name: 'U18' }],
        }}
        onOpen={jest.fn()}
      />,
    )

    expect(screen.getByText(/Da Ada Rossi/)).toBeTruthy()
    expect(screen.getByText('Non letto')).toBeTruthy()
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText('U18')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Messaggio non letto: Convocazione' })).toBeTruthy()
  })

  it('opens the existing message detail action', () => {
    const onOpen = jest.fn()
    render(<MessagePreviewRow message={{ id: 'message-1', subject: 'Avviso', content: 'Test', is_read: false }} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Messaggio non letto: Avviso' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
