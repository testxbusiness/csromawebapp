import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AthleteCalendarManager from './AthleteCalendarManager'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string) => url,
  useAccessibleProfiles: jest.fn(),
}))
jest.mock('@/context/TeamContext', () => ({ useTeamContext: jest.fn() }))
jest.mock('@/components/calendar/FullCalendarWidget', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/calendar/SimpleCalendar', () => ({
  __esModule: true,
  default: () => null,
}))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>
const teamMock = useTeamContext as jest.MockedFunction<typeof useTeamContext>

describe('AthleteCalendarManager load states', () => {
  const originalOnline = navigator.onLine

  beforeEach(() => {
    authMock.mockReturnValue({
      user: { id: 'user-1' } as ReturnType<typeof useAuth>['user'],
      session: null,
      profile: null,
      account: null,
      role: 'athlete',
      loading: false,
      profileLoading: false,
      refreshProfile: jest.fn(),
      signOut: jest.fn(),
      forceRefresh: jest.fn(),
      silentRefresh: jest.fn(),
    })
    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfile: null,
      selectedProfileId: null,
      setSelectedProfileId: jest.fn(),
      activeArea: 'personal',
      setActiveArea: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    })
    teamMock.mockReturnValue({
      teams: [],
      selectedTeamId: null,
      selectedTeam: null,
      setTeams: jest.fn(),
      setSelectedTeamId: jest.fn(),
      resetTeam: jest.fn(),
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  afterAll(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnline })
  })

  it('renders the valid empty state only after a successful empty response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ teams: [], events: [] }),
    }) as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getByText('Non sei iscritto a nessuna squadra')).toBeTruthy())
    expect(screen.queryByText('Impossibile caricare il calendario')).toBeNull()
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Mese' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /Vista Elenco|Vista Calendario/ })).toBeNull()
    const filterToggle = screen.getByRole('button', { name: /Filtri.*Tutti i tipi/i })
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(filterToggle)
    expect(filterToggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Allenamento' }))
    expect(screen.getByRole('button', { name: /Filtri.*Allenamento/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders an error state for an HTTP failure instead of empty content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Impossibile caricare il calendario' }),
    }) as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getByText('Impossibile caricare il calendario')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
    expect(screen.queryByText('Nessun evento trovato')).toBeNull()
  })

  it('renders an explicit offline state before attempting a network fetch', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    global.fetch = jest.fn() as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getByText('Calendario non disponibile offline')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('switches to the shared mobile month while preserving athlete agenda metadata and absence reporting', async () => {
    const start = new Date()
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(20, 0, 0, 0)

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        teams: [{ id: 'team-1', name: 'U16', code: 'U16' }],
        events: [{
          id: 'event-month', title: 'Allenamento mese', description: null, location: 'Palestra',
          start_time: start.toISOString(), end_time: end.toISOString(), is_recurring: false,
          teams: ['U16'], team_details: [{ id: 'team-1', name: 'U16', code: 'U16' }], team_ids: ['team-1'],
          event_kind: 'training', requires_confirmation: true,
          confirmation_deadline: new Date(Date.now() + 86_400_000).toISOString(),
          my_attendance: { status: 'maybe', responded_at: null },
        }, {
          id: 'event-month-conflict', title: 'Riunione sovrapposta', description: null, location: 'Palestra',
          start_time: start.toISOString(), end_time: end.toISOString(), is_recurring: false,
          teams: ['U16'], team_details: [{ id: 'team-1', name: 'U16', code: 'U16' }], team_ids: ['team-1'],
          event_kind: 'meeting', requires_confirmation: false, confirmation_deadline: null, my_attendance: null,
        }],
      }),
    }) as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getAllByText('Allenamento mese').length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: /^Mese$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Agenda$/ })).toHaveAttribute('aria-pressed', 'false')
    const monthName = start.toLocaleDateString('it-IT', { month: 'long' })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${start.getDate()} ${monthName}.*2 eventi`, 'i') }))

    expect(screen.getAllByText('U16').length).toBeGreaterThan(0)
    expect(screen.getByText(/Non puoi esserci\?/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /partecipo|forse|non partecipo/i })).toBeNull()
  })

  it('loads a family subject calendar with view_schedule while keeping attendance read-only', async () => {
    const eventDate = new Date()
    eventDate.setHours(18, 0, 0, 0)
    const eventDateIso = eventDate.toISOString()
    const eventEndIso = new Date(eventDate.getTime() + 90 * 60 * 1000).toISOString()
    const monthName = eventDate.toLocaleDateString('it-IT', { month: 'long' })
    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfileId: 'subject-1',
      selectedProfile: {
        profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: {
          view_schedule: true, confirm_attendance: false, view_payments: false,
          view_medical_status: false, view_documents: false, sign_documents: false,
          receive_messages: false,
        } },
      },
      setSelectedProfileId: jest.fn(),
      activeArea: 'family',
      setActiveArea: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        teams: [{ id: 'team-1', name: 'U16', code: 'U16' }],
        events: [{
          id: 'event-1', title: 'Allenamento famiglia', description: null, location: null,
          start_time: eventDateIso, end_time: eventEndIso,
          is_recurring: false, teams: ['U16'], team_details: [{ id: 'team-1', name: 'U16', code: 'U16' }],
          team_ids: ['team-1'], event_kind: 'training', requires_confirmation: true,
          confirmation_deadline: null, my_attendance: null,
        }],
      }),
    }) as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getAllByText('Allenamento famiglia').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${eventDate.getDate()} ${monthName}.*1 eventi`, 'i') }))
    expect(screen.getByText(/La segnalazione dell’assenza non è disponibile/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Partecipo' })).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/athlete/calendar', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('denies the family calendar when view_schedule is absent without requesting data', async () => {
    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfileId: 'subject-1',
      selectedProfile: {
        profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: {
          view_schedule: false, confirm_attendance: true, view_payments: false,
          view_medical_status: false, view_documents: false, sign_documents: false,
          receive_messages: false,
        } },
      },
      setSelectedProfileId: jest.fn(),
      activeArea: 'family',
      setActiveArea: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    })
    global.fetch = jest.fn() as jest.Mock

    render(<AthleteCalendarManager />)

    await waitFor(() => expect(screen.getByText('Accesso non abilitato')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
