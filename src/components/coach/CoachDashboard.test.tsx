import { render, screen, waitFor } from '@testing-library/react'
import CoachDashboard from './CoachDashboard'

const teamContextMock = jest.fn()
jest.mock('@/context/TeamContext', () => ({ useTeamContext: () => teamContextMock() }))

describe('CoachDashboard', () => {
  beforeEach(() => {
    teamContextMock.mockReturnValue({
      teams: [{ id: 'team-a', name: 'U16', code: 'U16' }],
      selectedTeamId: null,
      setTeams: jest.fn(),
    })
    globalThis.fetch = jest.fn()
  })

  it('renders the four operational questions from aggregated coach data', async () => {
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ id: 'team-a', name: 'U16' }], events: [{ id: 'event-a', title: 'Allenamento U16', start_time: '2026-09-01T17:00:00Z', end_time: '2026-09-01T19:00:00Z', event_kind: 'training', requires_confirmation: true }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'message-a', subject: 'Avviso allenamento', content: 'Portare la divisa.' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ counts: { going: 8, maybe: 1, declined: 1, no_response: 2 } }) })

    render(<CoachDashboard user={{ id: 'coach-a' }} profile={{ id: 'coach-a', first_name: 'Anna', last_name: 'Rossi', role: 'coach' }} />)

    await waitFor(() => expect(screen.getByText('Cosa ho oggi?')).toBeTruthy())
    expect(screen.getByText('Chi sarà presente?')).toBeTruthy()
    expect(screen.getByText('Qual è la prossima partita?')).toBeTruthy()
    expect(screen.getByText('Cosa devo comunicare?')).toBeTruthy()
    expect(screen.getByText('Allenamento U16')).toBeTruthy()
    expect(screen.getByLabelText('Tipo evento: Allenamento')).toBeTruthy()
    expect(screen.getByText('Avviso allenamento')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })

  it('passes the selected team to each coach data source', async () => {
    teamContextMock.mockReturnValue({ teams: [{ id: 'team-a', name: 'U16' }, { id: 'team-b', name: 'U18' }], selectedTeamId: 'team-b', setTeams: jest.fn() })
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ id: 'team-b', name: 'U18' }], events: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })

    render(<CoachDashboard user={{ id: 'coach-a' }} profile={{ id: 'coach-a', first_name: 'Anna', last_name: 'Rossi', role: 'coach' }} />)

    await waitFor(() => expect(screen.getByText('Nessun impegno imminente')).toBeTruthy())
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, '/api/coach/calendar?team_id=team-b', { cache: 'no-store' })
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, '/api/coach/messages?limit=3&team_id=team-b', { cache: 'no-store' })
  })

  it('surfaces overlapping commitments instead of choosing a priority', async () => {
    ;(globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ teams: [{ id: 'team-a', name: 'U16' }], events: [
        { id: 'event-a', title: 'Allenamento', start_time: '2026-09-01T17:00:00Z', end_time: '2026-09-01T19:00:00Z', event_kind: 'training' },
        { id: 'event-b', title: 'Riunione', start_time: '2026-09-01T18:00:00Z', end_time: '2026-09-01T20:00:00Z', event_kind: 'meeting' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })

    render(<CoachDashboard user={{ id: 'coach-a' }} profile={{ id: 'coach-a', first_name: 'Anna', last_name: 'Rossi', role: 'coach' }} />)

    await waitFor(() => expect(screen.getByText('2 impegni coinvolti in una sovrapposizione.')).toBeTruthy())
  })
})
