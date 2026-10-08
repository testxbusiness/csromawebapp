import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { usePush } from '@/hooks/usePush'
import type { AthleteProfileContract } from '@/types/athlete-profile'
import AthleteProfileManager from './AthleteProfileManager'
import { athleteKeys } from '@/lib/query-keys'

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({ appendSubjectProfile: (url: string) => url, useAccessibleProfiles: jest.fn() }))
jest.mock('@/hooks/usePush', () => ({ usePush: jest.fn() }))
jest.mock('@/components/pwa/InstallPwaButton', () => ({ __esModule: true, default: () => <button type="button">Installa app</button> }))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>
const pushMock = usePush as jest.MockedFunction<typeof usePush>
const subscribeMock = jest.fn()
const unsubscribeMock = jest.fn()

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderManager(queryClient = createQueryClient()) {
  return render(<QueryClientProvider client={queryClient}><AthleteProfileManager /></QueryClientProvider>)
}

const data: AthleteProfileContract = {
  account: { status: 'active', roles: ['athlete'], must_change_password: false },
  subject: { id: 'profile-1', first_name: 'Luca', last_name: 'Rossi', email: 'luca@example.test', phone: '123', birth_date: '2010-01-01', delegated: false },
  athlete: {
    membership_number: 'T-10',
    medical: { status: 'valid', expires_at: '2026-12-31' },
    documents: { can_view: false, can_sign: false, items: [] },
  },
  permissions: { view_medical_status: true, view_documents: false, sign_documents: false },
  memberships: [
    { id: 'membership-1', jersey_number: 7, team: { id: 'team-1', name: 'U16', code: 'U16-E', activity: { id: 'activity-1', name: 'Volley' } } },
    { id: 'membership-2', jersey_number: 12, team: { id: 'team-2', name: 'U18', code: 'U18-E', activity: { id: 'activity-1', name: 'Volley' } } },
  ],
}

describe('AthleteProfileManager', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    authMock.mockReturnValue({ user: { id: 'auth-1' } as ReturnType<typeof useAuth>['user'], session: null, profile: null, account: { authUserId: 'auth-1', ownerProfileId: 'profile-1', accountStatus: 'active', roles: ['athlete'], mustChangePassword: false }, role: 'athlete', loading: false, profileLoading: false, refreshProfile: jest.fn(), signOut: jest.fn(), forceRefresh: jest.fn(), silentRefresh: jest.fn() })
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: null, selectedProfileId: null, setSelectedProfileId: jest.fn(), activeArea: 'personal', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    subscribeMock.mockReset()
    unsubscribeMock.mockReset()
    pushMock.mockReturnValue({ subscribe: subscribeMock, unsubscribe: unsubscribeMock, registerSW: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => data }) as jest.Mock
  })

  it('separates sports identity/memberships from account settings', async () => {
    renderManager()
    await waitFor(() => expect(screen.getByText('Identità sportiva')).toBeTruthy())
    expect(screen.getByText('Numero tessera')).toBeTruthy()
    expect(screen.getByText('#7')).toBeTruthy()
    expect(screen.getByText('#12')).toBeTruthy()
    expect(screen.getByText('Impostazioni e sicurezza')).toBeTruthy()
    expect(screen.getByText('Notifiche e app')).toBeTruthy()
    expect(screen.getByText('Installazione PWA')).toBeTruthy()
    expect(screen.getByText('Accesso rapido e notifiche dal dispositivo.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Installa app' })).toBeTruthy()
    expect(screen.queryByText('Accesso ai documenti')).toBeNull()
  })

  it('does not render the medical card for a delegated subject', async () => {
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: { profile: { id: 'profile-2', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { id: 'relationship-1', type: 'parent', verified_at: '2026-01-01', permissions: { view_schedule: true, confirm_attendance: false, view_payments: false, view_medical_status: true, view_documents: false, sign_documents: false, receive_messages: false } } }, selectedProfileId: 'profile-2', setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...data, subject: { ...data.subject, id: 'profile-2', delegated: true }, athlete: { ...data.athlete, medical: { status: 'expiring', expires_at: null } } }) }) as jest.Mock
    renderManager()
    await waitFor(() => expect(screen.getByText('Stai visualizzando Luca Rossi')).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'Certificato medico' })).toBeNull()
  })

  it('renders authorized documents without exposing a signing action', async () => {
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: { profile: { id: 'profile-2', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { id: 'relationship-1', type: 'parent', verified_at: '2026-01-01', permissions: { view_schedule: true, confirm_attendance: false, view_payments: false, view_medical_status: false, view_documents: true, sign_documents: true, receive_messages: false } } }, selectedProfileId: 'profile-2', setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...data, subject: { ...data.subject, id: 'profile-2', delegated: true }, permissions: { view_medical_status: false, view_documents: true, sign_documents: true }, athlete: { ...data.athlete, medical: { status: 'hidden', expires_at: null }, documents: { can_view: true, can_sign: true, items: [{ id: 'document-1', title: 'Modulo iscrizione', status: 'generated', file_name: 'modulo.pdf', created_at: '2026-08-20T10:00:00Z' }] } } }) }) as jest.Mock
    renderManager()
    await waitFor(() => expect(screen.getByText('Documenti')).toBeTruthy())
    expect(screen.getByText('Modulo iscrizione')).toBeTruthy()
    expect(screen.getByText(/File disponibile/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /firma/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Certificato medico' })).toBeNull()
  })


  it('shows a retry state when the subject profile request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as jest.Mock
    renderManager()
    await waitFor(() => expect(screen.getByText('Non è stato possibile caricare il profilo')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('renders a denied state when the subject profile request is forbidden', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as jest.Mock
    renderManager()
    await waitFor(() => expect(screen.getByText('Accesso non abilitato')).toBeTruthy())
    expect(screen.getByText(/Non hai il permesso di visualizzare il profilo atleta/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Torna alla dashboard' }).getAttribute('href')).toBe('/dashboard')
  })

  it('shows an offline state before requesting the profile without a connection', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    renderManager()
    await waitFor(() => expect(screen.getByText('Profilo non disponibile offline')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('requests push setup only after an explicit click and shows a failure', async () => {
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default' } })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: jest.fn().mockResolvedValue({ pushManager: { getSubscription: jest.fn().mockResolvedValue(null) } }) } })
    subscribeMock.mockRejectedValue(new Error('Permission denied'))

    renderManager()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy())
    expect(subscribeMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Permesso notifiche non concesso'))
    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the loaded profile visible offline without manually refetching after reconnecting', async () => {
    renderManager()
    await waitFor(() => expect(screen.getByText('Identità sportiva')).toBeTruthy())

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))
    expect(screen.getByText('Profilo non aggiornato')).toBeTruthy()
    expect(screen.getAllByText('Luca Rossi')).toHaveLength(2)

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.queryByText('Profilo non aggiornato')).toBeNull())
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not manually refetch cached profile on reconnect', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(athleteKeys.profile('auth-1', 'profile-1'), data)
    renderManager(queryClient)

    expect(screen.getByText('Identità sportiva')).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Identità sportiva')).toBeTruthy()
  })

  it('renders a fresh cached profile immediately after remount without fetching again', async () => {
    const queryClient = createQueryClient()
    const firstRender = renderManager(queryClient)
    await waitFor(() => expect(screen.getByText('Identità sportiva')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledTimes(1)

    firstRender.unmount()
    renderManager(queryClient)

    expect(screen.getByText('Identità sportiva')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps cached profile visible while a background refetch is running', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(athleteKeys.profile('auth-1', 'profile-1'), data)
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => undefined)) as jest.Mock

    renderManager(queryClient)
    expect(screen.getByText('Identità sportiva')).toBeTruthy()

    void queryClient.invalidateQueries({ queryKey: athleteKeys.profile('auth-1', 'profile-1') })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Identità sportiva')).toBeTruthy()
    expect(screen.queryByText('Caricamento profilo...')).toBeNull()
  })

  it('does not use subject A data while subject B is loading', async () => {
    const queryClient = createQueryClient()
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => data })
      .mockImplementationOnce(() => new Promise(() => undefined)) as jest.Mock
    const view = renderManager(queryClient)
    await waitFor(() => expect(screen.getByText('Identità sportiva')).toBeTruthy())

    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfile: { profile: { id: 'profile-2', first_name: 'Anna', last_name: 'Bianchi', email: null }, relationship: { id: 'relationship-2', type: 'parent', verified_at: '2026-01-01', permissions: { view_schedule: true, confirm_attendance: true, view_payments: true, view_medical_status: true, view_documents: true, sign_documents: false, receive_messages: true } } },
      selectedProfileId: 'profile-2',
      setSelectedProfileId: jest.fn(),
      activeArea: 'family',
      setActiveArea: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
    })
    view.rerender(<QueryClientProvider client={queryClient}><AthleteProfileManager /></QueryClientProvider>)

    expect(screen.getByText('Caricamento profilo...')).toBeTruthy()
    expect(screen.queryByText('Luca Rossi')).toBeNull()
  })
})
