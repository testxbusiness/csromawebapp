import { fireEvent, render, screen } from '@testing-library/react'
import { CoachMessageRow } from './CoachMessagesManager'

describe('CoachMessageRow', () => {
  it('exposes unread state, recipients, attachments and keyboard-activatable row semantics', () => {
    const onOpen = jest.fn()
    render(<ul><CoachMessageRow
      ownProfileId="coach-a"
      onOpen={onOpen}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      message={{
        id: 'message-a', subject: 'Avviso', content: 'Portare la divisa.', created_by: 'admin-a', created_at: '2026-09-01T10:00:00Z',
        created_by_profile: { first_name: 'Anna', last_name: 'Rossi', role: 'admin' },
        message_recipients: [{ id: 'recipient-a', is_read: false, teams: { id: 'team-a', name: 'U16' } }],
        attachments: [{ id: 'attachment-a', file_name: 'divisa.pdf' }],
      }}
    /></ul>)

    const row = screen.getByRole('button', { name: 'Non letto: Avviso, Anna Rossi' })
    expect(row.className).toContain('cs-list-row--interactive')
    expect(screen.getByText('Non letto')).toBeTruthy()
    expect(screen.getByText('🏀 U16')).toBeTruthy()
    expect(screen.getByText('1 allegato')).toBeTruthy()
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.click(row)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
