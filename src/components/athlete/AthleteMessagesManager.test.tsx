import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AthleteMessagesManager from './AthleteMessagesManager'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string) => url,
  useAccessibleProfiles: jest.fn(),
}))
jest.mock('@/context/TeamContext', () => ({ useTeamContext: jest.fn() }))
jest.mock('@/components/shared/MessageDetailModal', () => ({ __esModule: true, default: () => null }))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>
const teamMock = useTeamContext as jest.MockedFunction<typeof useTeamContext>

function renderManager() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><AthleteMessagesManager /></QueryClientProvider>)
}

describe('AthleteMessagesManager load states', () => {
  const originalOnline = navigator.onLine

  beforeEach(() => {
    authMock.mockReturnValue({
      user: { id: 'user-1' } as ReturnType<typeof useAuth>['user'],
      session: null,
      profile: null,
      account: { authUserId: 'user-1', ownerProfileId: 'profile-1', accountStatus: 'active', roles: ['athlete'], mustChangePassword: false },
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
      json: async () => ({ teams: [], messages: [] }),
    }) as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByText('Nessun messaggio')).toBeTruthy())
    expect(screen.queryByText('Impossibile caricare i messaggi')).toBeNull()
  })

  it('renders an error state with retry for an HTTP failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Errore server' }),
    }) as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByText('Impossibile caricare i messaggi')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
    expect(screen.queryByText('Nessun messaggio')).toBeNull()
  })

  it('renders an explicit offline state without attempting a fetch', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    global.fetch = jest.fn() as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByText('Messaggi non disponibili offline')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not start a manual reconnect fetch while cached messages are fresh', async () => {
    const message = {
      id: 'message-1',
      subject: 'Allenamento',
      content: 'Dettagli',
      created_at: '2026-08-28T10:00:00.000Z',
      created_by_profile: { first_name: 'Coach', last_name: 'Roma', role: 'coach' },
      teams: [],
      team_ids: [],
      is_read: false,
      read_state: { is_read: false, read_at: null },
      message_recipients: [],
    }
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ teams: [], messages: [message] }),
    })
    global.fetch = fetchMock as jest.Mock

    renderManager()
    await waitFor(() => expect(screen.getByText('Allenamento')).toBeTruthy())

    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByText('Allenamento')).toBeTruthy()
    expect(screen.queryByText('Nessun messaggio')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads family messages for the selected subject and keeps the account-subject scope', async () => {
    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfileId: 'subject-1',
      selectedProfile: {
        profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: {
          view_schedule: false, confirm_attendance: false, view_payments: false,
          view_medical_status: false, view_documents: false, sign_documents: false,
          receive_messages: true,
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
        read_state_scope: 'account_subject',
        teams: [],
        messages: [{
          id: 'message-1', subject: 'Avviso famiglia', content: 'Dettagli',
          created_at: '2026-08-28T10:00:00.000Z', created_by_profile: { first_name: 'Coach', last_name: 'Roma', role: 'coach' },
          teams: [], team_ids: [], is_read: false, read_state: { is_read: false, read_at: null },
          message_recipients: [],
        }],
      }),
    }) as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByText('Avviso famiglia')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledWith('/api/athlete/messages?view=minimal', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('loads the full message only when the list row is opened', async () => {
    const message = {
      id: 'message-1', subject: 'Avviso famiglia', content: 'Anteprima',
      created_at: '2026-08-28T10:00:00.000Z', created_by_profile: { first_name: 'Coach', last_name: 'Roma', role: 'coach' },
      teams: [], team_ids: [], is_read: false, read_state: { is_read: false, read_at: null }, message_recipients: [],
    }
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ teams: [], messages: [message] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ teams: [], messages: [{ ...message, attachments: [{ id: 'attachment-1', file_name: 'orari.pdf' }] }] }) })
    global.fetch = fetchMock as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByRole('button', { name: /Avviso famiglia/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Avviso famiglia/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/athlete/messages?view=full&id=message-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it('denies family messages without receive_messages before loading another subject payload', async () => {
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
    global.fetch = jest.fn() as jest.Mock

    renderManager()

    await waitFor(() => expect(screen.getByText('Accesso non abilitato')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
