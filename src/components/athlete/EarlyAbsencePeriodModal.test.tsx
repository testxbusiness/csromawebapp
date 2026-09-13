import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import EarlyAbsencePeriodModal from './EarlyAbsencePeriodModal'

jest.mock('@/components/ui/Modal', () => ({
  __esModule: true,
  default: ({ open, title, description, children }: { open: boolean; title: string; description: string; children: React.ReactNode }) => open ? <div role="dialog"><h2>{title}</h2><p>{description}</p>{children}</div> : null,
}))

const event = (id: string, team: string, day: string) => ({
  id, title: `Allenamento ${team}`, description: null, location: 'Palestra',
  start_time: `${day}T16:00:00.000Z`, end_time: `${day}T17:30:00.000Z`, is_recurring: false,
  teams: [team], team_details: [{ id: team, name: team, code: team }], team_ids: [team],
  event_kind: 'training', requires_confirmation: true, confirmation_deadline: null,
  my_attendance: null,
})

describe('EarlyAbsencePeriodModal', () => {
  beforeEach(() => { global.fetch = jest.fn() as jest.Mock })

  it('loads a multi-team period, selects partially and submits only confirmed ids', async () => {
    const { teams: _teams, ...eventWithoutLegacyTeams } = event('u14', 'U14', '2026-09-14')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [eventWithoutLegacyTeams, event('u16', 'U16', '2026-09-15')], has_more: false, next_offset: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    const onSaved = jest.fn()
    render(<EarlyAbsencePeriodModal open subjectProfileId={null} onClose={jest.fn()} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Data iniziale'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Data finale'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cerca eventi' }))

    await waitFor(() => expect(screen.getByText('U14')).toBeTruthy())
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText(/tutte le squadre autorizzate/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Allenamento U14' }))
    fireEvent.change(screen.getByLabelText(/Nota comune/), { target: { value: 'Impegno scolastico' } })
    expect(screen.getByText(/1\s+selezionati/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Conferma assenza' }))

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST' })))
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({ event_ids: ['u14'], note: 'Impegno scolastico' })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('paginates loaded events and does not confirm hidden pages as selected', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [event('first', 'U14', '2026-09-14')], has_more: true, next_offset: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [event('second', 'U16', '2026-09-15')], has_more: false, next_offset: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    render(<EarlyAbsencePeriodModal open subjectProfileId="subject-1" onClose={jest.fn()} onSaved={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Data iniziale'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Data finale'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cerca eventi' }))
    await waitFor(() => expect(screen.getByText('U14')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Seleziona tutti gli eventi caricati' }))
    fireEvent.click(screen.getByRole('button', { name: 'Carica altri eventi' }))
    await waitFor(() => expect(screen.getByText('U16')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Conferma assenza' }))
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls[2][1].method).toBe('POST'))
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body).event_ids).toEqual(['first'])
  })

  it('keeps the dialog open and refreshes atomically after a stale-event rejection', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [event('stale', 'U14', '2026-09-14')], has_more: false }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Aggiorna il riepilogo' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], has_more: false }) })
    render(<EarlyAbsencePeriodModal open subjectProfileId="subject-1" onClose={jest.fn()} onSaved={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Data iniziale'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Data finale'), { target: { value: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cerca eventi' }))
    await waitFor(() => expect(screen.getByText('U14')).toBeTruthy())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleziona Allenamento U14' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma assenza' }))
    await waitFor(() => expect(screen.getByText('Aggiorna il riepilogo')).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Comunica assenza' })).toBeTruthy()
    expect(screen.queryByText(/Nessun evento eleggibile/)).toBeNull()
  })

  it('resets the period and selection when the subject changes', async () => {
    const { rerender } = render(<EarlyAbsencePeriodModal open subjectProfileId="subject-1" onClose={jest.fn()} onSaved={jest.fn()} />)
    fireEvent.change(screen.getByLabelText('Data iniziale'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Data finale'), { target: { value: '2026-09-20' } })
    rerender(<EarlyAbsencePeriodModal open subjectProfileId="subject-2" onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByLabelText('Data iniziale')).toHaveValue('')
    expect(screen.getByLabelText('Data finale')).toHaveValue('')
  })
})
