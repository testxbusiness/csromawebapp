import { fireEvent, render, screen } from '@testing-library/react'
import { AthleteMessageList } from './AthleteMessageList'

describe('AthleteMessageList', () => {
  it('renders one semantic list row with the required message metadata', () => {
    const onOpen = jest.fn()
    render(
      <AthleteMessageList
        onOpen={onOpen}
        messages={[{
          id: 'm1',
          subject: 'Convocazione',
          content: 'Presentarsi in palestra alle 18.',
          created_at: new Date().toISOString(),
          is_read: false,
          created_by_profile: { first_name: 'Anna', last_name: 'Rossi', role: 'coach' },
          teams: [{ id: 't1', name: 'U16' }],
          attachments: [{ id: 'a1', file_name: 'orari.pdf' }],
        }]}
      />
    )

    expect(screen.getByRole('list', { name: 'Lista messaggi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Non letto: Convocazione, Anna Rossi/i })).toBeTruthy()
    expect(screen.getByText('Coach')).toBeTruthy()
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText('1 allegato')).toBeTruthy()
    expect(screen.queryByText('🏀')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Convocazione/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })
})
