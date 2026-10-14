import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { usePush } from '@/hooks/usePush'
import type { AthleteProfileContract } from '@/types/athlete-profile'
import AthleteProfileManager, { type AthleteProfileSection } from './AthleteProfileManager'

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({ appendSubjectProfile: (url: string) => url, useAccessibleProfiles: jest.fn() }))
jest.mock('@/hooks/usePush', () => ({ usePush: jest.fn() }))
jest.mock('@/components/pwa/InstallPwaButton', () => ({ __esModule: true, default: () => <button type="button">Installa app</button> }))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>
const pushMock = usePush as jest.MockedFunction<typeof usePush>
const subscribeMock = jest.fn()
const unsubscribeMock = jest.fn()

function createQueryClient() { return new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
function renderManager(section: AthleteProfileSection = 'overview', queryClient = createQueryClient()) { return render(<QueryClientProvider client={queryClient}><AthleteProfileManager section={section} /></QueryClientProvider>) }

const data: AthleteProfileContract = {
  account: { status: 'active', roles: ['athlete'], must_change_password: false },
  subject: { id: 'profile-1', first_name: 'Luca', last_name: 'Rossi', email: 'luca@example.test', phone: '123', birth_date: '2010-01-01', delegated: false },
  athlete: { membership_number: 'T-10', medical: { status: 'valid', expires_at: '2026-12-31' }, documents: { can_view: true, can_sign: false, items: [{ id: 'document-1', title: 'Modulo iscrizione', status: 'generated', file_name: 'modulo.pdf', created_at: '2026-08-20T10:00:00Z' }] } },
  permissions: { view_medical_status: true, view_documents: true, sign_documents: false },
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
    subscribeMock.mockReset(); unsubscribeMock.mockReset()
    pushMock.mockReturnValue({ subscribe: subscribeMock, unsubscribe: unsubscribeMock, registerSW: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => data }) as jest.Mock
  })

  it('renders a compact root hub without duplicated detail sections or administration alerts', async () => {
    renderManager()
    expect((await screen.findAllByText('Luca Rossi')).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Amministrazione/ })).toHaveAttribute('href', '/athlete/fees')
    expect(screen.getByRole('link', { name: /Dati sportivi/ })).toHaveAttribute('href', '/athlete/profile/sports')
    expect(screen.getByRole('link', { name: /Documenti/ })).toHaveAttribute('href', '/athlete/profile/documents')
    expect(screen.getByRole('link', { name: /Account e app/ })).toHaveAttribute('href', '/athlete/profile/account')
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.queryByText('Da completare')).toBeNull()
    expect(screen.queryByText('Impostazioni e sicurezza')).toBeNull()
    expect(screen.queryByText('Squadre e numeri di maglia')).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps delegated identity and document permission boundaries', async () => {
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: { profile: { id: 'profile-2', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { id: 'relationship-1', type: 'parent', verified_at: '2026-01-01', permissions: { view_schedule: true, confirm_attendance: false, view_payments: false, view_medical_status: true, view_documents: false, sign_documents: false, receive_messages: false } } }, selectedProfileId: 'profile-2', setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...data, subject: { ...data.subject, id: 'profile-2', delegated: true }, permissions: { ...data.permissions, view_documents: false }, athlete: { ...data.athlete, documents: { ...data.athlete.documents, can_view: false, items: [] } } }) }) as jest.Mock
    renderManager()
    expect(await screen.findByText('Stai visualizzando Luca Rossi')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Documenti/ })).toBeNull()
  })

  it('moves sports details to the sports subroute without an additional query', async () => {
    renderManager('sports')
    expect(await screen.findByRole('heading', { name: 'Dati sportivi' })).toBeTruthy()
    expect(screen.getByText('Numero tessera')).toBeTruthy()
    expect(screen.getByText('#7')).toBeTruthy()
    expect(screen.getByText('#12')).toBeTruthy()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('moves documents and empty state to the documents subroute', async () => {
    renderManager('documents')
    expect(await screen.findByRole('heading', { name: 'Documenti', level: 1 })).toBeTruthy()
    expect(screen.getByText('Modulo iscrizione')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /firma/i })).toBeNull()
  })

  it('keeps notifications, PWA, theme and logout in Account e app', async () => {
    const signOut = jest.fn()
    authMock.mockReturnValue({ ...authMock(), signOut })
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default' } })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: jest.fn().mockResolvedValue({ pushManager: { getSubscription: jest.fn().mockResolvedValue(null) } }) } })
    renderManager('account')
    expect(await screen.findByText('Notifiche push')).toBeTruthy()
    expect(screen.getByText('Installazione PWA')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Attiva tema/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Esci dall’account' })).toBeTruthy()
    expect(screen.queryByText('Squadre e numeri di maglia')).toBeNull()
  })

  it('shows error and offline states without hiding current behavior', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as jest.Mock
    renderManager()
    expect(await screen.findByText('Non è stato possibile caricare il profilo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    global.fetch = jest.fn() as jest.Mock
    renderManager()
    expect(await screen.findByText('Profilo non disponibile offline')).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('renders cached profile immediately and does not create a second administration fetch', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(['athlete', 'auth-1', 'profile-1', 'profile'], data)
    renderManager('overview', queryClient)
    expect(screen.getAllByText('Luca Rossi').length).toBeGreaterThan(0)
    expect(global.fetch).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Da completare')).toBeNull())
  })
})
