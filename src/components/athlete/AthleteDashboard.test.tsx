import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AthleteDashboard, { formatAgendaDateTime, getFeaturedEventState, shouldShowNextChampionshipMatchSummary } from './AthleteDashboard'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ role: 'family_member', loading: false, profileLoading: false }) }))
jest.mock('@/context/TeamContext', () => ({
  useTeamContext: () => ({ selectedTeamId: null, setTeams: jest.fn(), resetTeam: jest.fn() }),
}))
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string) => url,
  SUBJECT_CONTEXT_CHANGED_EVENT: 'csroma:subject-context-changed',
  useAccessibleProfiles: jest.fn(() => ({
    selectedProfileId: 'child-1',
    selectedProfile: {
      profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null },
      relationship: { permissions: {
        view_schedule: true, confirm_attendance: false, view_payments: false,
        view_medical_status: false, view_documents: false, sign_documents: false,
        receive_messages: false,
      } },
    },
  })),
}))

describe('AthleteDashboard delegated mode', () => {
  afterEach(() => { delete (globalThis as { fetch?: unknown }).fetch })

  it('reuses the athlete dashboard with family context and omits unauthorized sections', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeSeason: { name: '2026' },
        teamMemberships: [],
        upcomingEvents: [{
          id: 'event-1', title: 'Allenamento delegato', start_time: '2026-09-01T18:00:00Z',
          end_time: '2026-09-01T19:30:00Z', requires_confirmation: true, my_attendance: null,
        }],
        unreadMessages: [], feeInstallments: [], teams: [],
      }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)

    await waitFor(() => expect(screen.getByText('Area familiare')).toBeTruthy())
    expect(screen.getByText('Stai visualizzando Luca Rossi')).toBeTruthy()
    expect(screen.getByText('Prossimo impegno')).toBeTruthy()
    expect(screen.getByText('Allenamento delegato')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Partecipo' })).toBeNull()
    expect(screen.queryByText('Messaggi non letti')).toBeNull()
    expect(screen.queryByText('Prossima quota')).toBeNull()
  })

  it('does not leak a stale message detail after the subject context changes', async () => {
    ;(useAccessibleProfiles as jest.Mock).mockReturnValue({
      selectedProfileId: 'child-1',
      selectedProfile: { profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { permissions: {
        view_schedule: true, confirm_attendance: false, view_payments: false,
        view_medical_status: false, view_documents: false, sign_documents: false,
        receive_messages: true,
      } } },
    })
    let resolveDetail!: (value: unknown) => void
    const detailResponse = new Promise((resolve) => { resolveDetail = resolve })
    const dashboardResponse = { ok: true, json: async () => ({ activeSeason: null, teamMemberships: [], upcomingEvents: [], unreadMessages: [{ id: 'message-1', subject: 'Messaggio vecchio', content: 'Anteprima', is_read: false }], feeInstallments: [], teams: [] }) }
    globalThis.fetch = jest.fn().mockImplementation((url: string) => url.includes('id=message-1') ? detailResponse : Promise.resolve(dashboardResponse)) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)
    await waitFor(() => expect(screen.getByText('Messaggio vecchio')).toBeTruthy())

    screen.getByText('Messaggio vecchio').closest('button')?.click()
    window.dispatchEvent(new CustomEvent('csroma:subject-context-changed', { detail: { subjectProfileId: 'child-2' } }))
    resolveDetail({ ok: true, json: async () => ({ messages: [{ id: 'message-1', subject: 'Dettaglio non autorizzato', content: 'Privato' }] }) })

    await waitFor(() => expect(screen.queryByText('Dettaglio non autorizzato')).toBeNull())
  })

  it('aborts a stale RSVP mutation when the subject context changes', async () => {
    ;(useAccessibleProfiles as jest.Mock).mockReturnValue({
      selectedProfileId: 'child-1',
      selectedProfile: { profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { permissions: {
        view_schedule: true, confirm_attendance: true, view_payments: false, view_medical_status: false,
        view_documents: false, sign_documents: false, receive_messages: false,
      } } },
    })
    let resolveAttendance!: (value: unknown) => void
    const attendanceResponse = new Promise((resolve) => { resolveAttendance = resolve })
    const dashboardResponse = { ok: true, json: async () => ({
      activeSeason: null,
      teamMemberships: [],
      upcomingEvents: [{
        id: 'event-1', title: 'Allenamento delegato', start_time: '2026-09-01T18:00:00Z',
        end_time: '2026-09-01T19:30:00Z', requires_confirmation: true, my_attendance: null,
      }],
      unreadMessages: [], feeInstallments: [], teams: [],
    }) }
    globalThis.fetch = jest.fn().mockImplementation((url: string) => (
      url.includes('/events/attendance') ? attendanceResponse : Promise.resolve(dashboardResponse)
    )) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partecipo' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Partecipo' }))
    await waitFor(() => expect((globalThis.fetch as jest.Mock).mock.calls.some(([url]) => url.includes('/events/attendance'))).toBe(true))

    window.dispatchEvent(new CustomEvent('csroma:subject-context-changed', { detail: { subjectProfileId: 'child-2' } }))
    resolveAttendance({ ok: true, json: async () => ({}) })

    const attendanceCall = (globalThis.fetch as jest.Mock).mock.calls.find(([url]) => url.includes('/events/attendance'))
    await waitFor(() => expect(attendanceCall?.[1].signal.aborted).toBe(true))
    expect(screen.queryByText('Risposta salvata')).toBeNull()
  })
})

describe('featured event state', () => {
  const now = new Date('2026-09-14T18:00:00.000Z')

  it.each([
    ['future', '2026-09-14T19:00:00.000Z', '2026-09-14T20:00:00.000Z', 'upcoming'],
    ['in progress', '2026-09-14T17:00:00.000Z', '2026-09-14T19:00:00.000Z', 'in_progress'],
    ['ended', '2026-09-14T16:00:00.000Z', '2026-09-14T17:00:00.000Z', 'ended'],
  ])('%s event is classified from its interval', (_name, start_time, end_time, expected) => {
    expect(getFeaturedEventState({ start_time, end_time }, now)).toBe(expected)
  })

  it('returns unknown for absent/invalid timing data', () => {
    expect(getFeaturedEventState({ start_time: '', end_time: '' }, now)).toBe('unknown')
  })

  it('keeps the contract-selected ended event ahead of a later event', async () => {
    const current = Date.now()
    const endedEvent = { id: 'ended-first', title: 'Evento già terminato', start_time: new Date(current - 7_200_000).toISOString(), end_time: new Date(current - 3_600_000).toISOString(), requires_confirmation: false }
    const laterEvent = { id: 'later-event', title: 'Evento successivo', start_time: new Date(current + 3_600_000).toISOString(), end_time: new Date(current + 7_200_000).toISOString(), requires_confirmation: false }
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ activeSeason: null, teamMemberships: [], upcomingEvents: [endedEvent, laterEvent], unreadMessages: [], feeInstallments: [], teams: [] }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)

    await waitFor(() => expect(screen.getByText('Evento già terminato')).toBeTruthy())
    expect(screen.getByRole('status', { name: 'Terminato' })).toBeTruthy()
    expect(screen.getByText('Evento successivo')).toBeTruthy()
  })

  it('keeps a long title renderable while exposing an explicit state', async () => {
    const title = 'Allenamento con titolo molto lungo per verificare il ritorno a capo nella scheda protagonista'
    const start = new Date(Date.now() + 3_600_000).toISOString()
    const end = new Date(Date.now() + 7_200_000).toISOString()
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeSeason: null,
        teamMemberships: [],
        upcomingEvents: [{ id: 'long-event', title, start_time: start, end_time: end, requires_confirmation: false }],
        unreadMessages: [], feeInstallments: [], teams: [],
      }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)

    await waitFor(() => expect(screen.getByText(title)).toBeTruthy())
    expect(screen.getByRole('status', { name: 'Prossimo' })).toBeTruthy()
  })
})

describe('dashboard agenda preview', () => {
  it('does not render an agenda section when there are no events', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ activeSeason: null, teamMemberships: [], upcomingEvents: [], unreadMessages: [], feeInstallments: [], teams: [] }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'athlete-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} />)

    await waitFor(() => expect(screen.getByText('Nessun impegno programmato')).toBeTruthy())
    expect(screen.queryByLabelText('Poi in agenda')).toBeNull()
  })

  it('does not render a secondary agenda when there is only the protagonist event', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeSeason: null,
        teamMemberships: [],
        upcomingEvents: [{ id: 'event-1', title: 'Allenamento unico', event_kind: 'training', start_time: '2026-09-15T20:00:00+02:00', end_time: '2026-09-15T21:00:00+02:00', requires_confirmation: false }],
        unreadMessages: [], feeInstallments: [], teams: [],
      }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'athlete-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} />)

    await waitFor(() => expect(screen.getByText('Allenamento unico')).toBeTruthy())
    expect(screen.queryByLabelText('Poi in agenda')).toBeNull()
  })

  it('uses a compact local date/time label for today, tomorrow and future dates', () => {
    const now = new Date('2026-09-15T10:00:00+02:00')

    expect(formatAgendaDateTime('2026-09-15T20:00:00+02:00', now)).toBe('Oggi · 20:00')
    expect(formatAgendaDateTime('2026-09-16T20:00:00+02:00', now)).toBe('Domani · 20:00')
    expect(formatAgendaDateTime('2026-09-20T20:00:00+02:00', now)).toMatch(/domenica 20 settembre · 20:00/)
  })

  it('keeps three agenda events readable with one team/type/place line and a full-row detail action', async () => {
    const events = [
      { id: 'event-1', title: 'Protagonista', event_kind: 'training', start_time: '2026-09-15T18:00:00+02:00', end_time: '2026-09-15T19:00:00+02:00', requires_confirmation: false },
      { id: 'event-2', title: 'Allenamento Under 17 con un titolo molto lungo che non deve rompere la riga', event_kind: 'training', start_time: '2026-09-15T20:00:00+02:00', end_time: '2026-09-15T21:00:00+02:00', location: 'Cardarelli', teams: [{ id: 'team-17', name: 'Under 17', code: 'U17' }], requires_confirmation: false },
      { id: 'event-3', title: 'Riunione tecnica', event_kind: 'meeting', start_time: '2026-09-16T20:00:00+02:00', end_time: '2026-09-16T21:00:00+02:00', location: 'Sala riunioni', teams: [{ id: 'team-17', name: 'Under 17', code: 'U17' }, { id: 'team-15', name: 'Under 15', code: 'U15' }], requires_confirmation: false },
    ]
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ activeSeason: null, teamMemberships: [], upcomingEvents: events, unreadMessages: [], feeInstallments: [], teams: [] }) }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'athlete-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apri dettaglio: Riunione tecnica' })).toBeTruthy())
    expect(screen.getByText('Oggi · 20:00')).toBeTruthy()
    expect(screen.getByText('Domani · 20:00')).toBeTruthy()
    expect(screen.getByText('Cardarelli')).toBeTruthy()
    expect(screen.getByText('Under 17 · Under 15')).toBeTruthy()
    const secondEventRow = screen.getByRole('button', { name: 'Apri dettaglio: Allenamento Under 17 con un titolo molto lungo che non deve rompere la riga' })
    expect(within(secondEventRow).getAllByLabelText('Tipo evento: Allenamento')).toHaveLength(1)

    const detailRow = screen.getByRole('button', { name: 'Apri dettaglio: Riunione tecnica' })
    detailRow.focus()
    expect(document.activeElement).toBe(detailRow)
    await userEvent.setup().keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: /Dettaglio evento/i })).toBeTruthy()
  })
})

describe('next championship match summary visibility', () => {
  const championshipMatch = { event_id: 'match-event' }

  it('hides the summary only when an explicit event link proves duplication', () => {
    expect(shouldShowNextChampionshipMatchSummary({ id: 'match-event', event_kind: 'match' }, championshipMatch)).toBe(false)
  })

  it('keeps the summary after a non-match first event', () => {
    expect(shouldShowNextChampionshipMatchSummary({ id: 'training-event', event_kind: 'training' }, championshipMatch)).toBe(true)
  })

  it('keeps an unlinked championship match visible for a friendly or incomplete event payload', () => {
    expect(shouldShowNextChampionshipMatchSummary({ id: 'friendly-event', event_kind: 'match' }, { event_id: null })).toBe(true)
    expect(shouldShowNextChampionshipMatchSummary({ id: 'match-event', event_kind: 'match' }, {})).toBe(true)
    expect(shouldShowNextChampionshipMatchSummary({ id: 'match-event', event_kind: 'match' }, null)).toBe(false)
  })

  it('keeps the family dashboard consumer on the same conservative rule', () => {
    expect(shouldShowNextChampionshipMatchSummary(undefined, championshipMatch)).toBe(true)
  })

  it('applies the rule in the delegated dashboard without changing read-only access', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activeSeason: null,
        teamMemberships: [],
        upcomingEvents: [{
          id: 'match-event', title: 'Partita protagonista', event_kind: 'match',
          start_time: '2026-09-20T18:00:00Z', end_time: '2026-09-20T20:00:00Z',
        }],
        nextChampionshipMatch: { event_id: 'match-event', match_date: '2026-09-20', start_time: '18:00' },
        unreadMessages: [], feeInstallments: [], teams: [],
      }),
    }) as jest.Mock

    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)

    await waitFor(() => expect(screen.getByText('Partita protagonista')).toBeTruthy())
    expect(screen.queryByText('Prossima partita')).toBeNull()
  })
})

describe('dashboard secondary services', () => {
  const permissions = {
    view_schedule: true,
    confirm_attendance: false,
    view_payments: true,
    view_medical_status: false,
    view_documents: false,
    sign_documents: false,
    receive_messages: true,
  }

  const renderFamilyDashboard = (payload: Record<string, unknown>) => {
    ;(useAccessibleProfiles as jest.Mock).mockReturnValue({
      selectedProfileId: 'child-1',
      selectedProfile: {
        profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { permissions },
      },
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload }) as jest.Mock
    render(<AthleteDashboard user={{ id: 'account-1' }} profile={{ id: 'child-1', first_name: 'Luca', last_name: 'Rossi', role: 'athlete' }} delegatedView />)
  }

  const basePayload = { activeSeason: null, teamMemberships: [], upcomingEvents: [], feeInstallments: [], teams: [] }

  it.each([
    ['zero', [], 0],
    ['two', [
      { id: 'message-1', subject: 'Avviso 1', content: 'Test 1', is_read: false },
      { id: 'message-2', subject: 'Avviso 2', content: 'Test 2', is_read: false },
    ], 2],
    ['three', [
      { id: 'message-1', subject: 'Avviso 1', content: 'Test 1', is_read: false },
      { id: 'message-2', subject: 'Avviso 2', content: 'Test 2', is_read: false },
      { id: 'message-3', subject: 'Avviso 3', content: 'Test 3', is_read: false },
    ], 3],
  ])('renders the %s message state with the total in the heading', async (_label, messages, count) => {
    renderFamilyDashboard({ ...basePayload, unreadMessages: messages, unreadMessageCount: count })

    await waitFor(() => expect(screen.getByRole('heading', { name: `Messaggi non letti (${count})` })).toBeTruthy())
    expect(screen.queryAllByRole('button', { name: /^Messaggio:/ })).toHaveLength(Math.min(messages.length, 3))
    expect(screen.queryByText('Non letto')).toBeNull()
    if (messages.length === 0) expect(screen.getByText('Nessun messaggio non letto')).toBeTruthy()
  })

  it('keeps an overdue fee ahead of a paid fee and formats the amount in Italian', async () => {
    renderFamilyDashboard({
      ...basePayload,
      unreadMessages: [],
      feeInstallments: [
        { id: 'paid', installment_number: 1, due_date: '2026-09-01', amount: 80, status: 'paid', membership_fee: { name: 'Quota annuale', team: { id: 'team-1', name: 'U16', code: 'U16', activity: { name: 'Volley' } } } },
        { id: 'overdue', installment_number: 2, due_date: '2026-08-01', amount: 120, status: 'overdue', membership_fee: { name: 'Quota annuale', team: { id: 'team-1', name: 'U16', code: 'U16', activity: { name: 'Volley' } } } },
      ],
    })

    await waitFor(() => expect(screen.getByText('Scaduta')).toBeTruthy())
    expect(screen.getByText(/120,00/)).toBeTruthy()
    expect(screen.queryByText('80,00')).toBeNull()
  })

  it('shows the paid state when no unpaid installment is available', async () => {
    renderFamilyDashboard({
      ...basePayload,
      unreadMessages: [],
      feeInstallments: [{ id: 'paid', installment_number: 1, due_date: '2026-09-01', amount: 120, status: 'paid', membership_fee: { name: 'Quota annuale', team: { id: 'team-1', name: 'U16', code: 'U16', activity: { name: 'Volley' } } } }],
    })

    await waitFor(() => expect(screen.getByText('Pagata')).toBeTruthy())
    expect(screen.getByText(/120,00/)).toBeTruthy()
  })

  it('keeps each team membership and its authoritative jersey number', async () => {
    renderFamilyDashboard({
      ...basePayload,
      unreadMessages: [],
      teamMemberships: [
        { id: 'membership-1', jersey_number: 7, team: { id: 'team-1', name: 'U16', code: 'U16', activity: { name: 'Volley' } } },
        { id: 'membership-2', jersey_number: 12, team: { id: 'team-2', name: 'U18', code: 'U18', activity: { name: 'Volley' } } },
      ],
    })

    await waitFor(() => expect(screen.getByText('Le tue squadre')).toBeTruthy())
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText('U18')).toBeTruthy()
    expect(screen.getByText('#7')).toBeTruthy()
    expect(screen.getByText('#12')).toBeTruthy()
  })
})
