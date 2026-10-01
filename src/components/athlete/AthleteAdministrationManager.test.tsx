import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import AthleteAdministrationManager from './AthleteAdministrationManager'

let section = ''

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(section) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string, subjectProfileId?: string | null) => subjectProfileId ? `${url}?subjectProfileId=${subjectProfileId}` : url,
  SUBJECT_CONTEXT_CHANGED_EVENT: 'subject-context-changed',
  useAccessibleProfiles: jest.fn(),
}))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>

const contract = {
  enrollment_application: { delivered: false },
  medical_certificate: { status: 'expiring' as const, expires_at: '2026-10-20' },
  fees: { installments: [] },
}

describe('AthleteAdministrationManager', () => {
  beforeEach(() => {
    section = ''
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    authMock.mockReturnValue({
      user: { id: 'user-1' } as ReturnType<typeof useAuth>['user'], session: null, profile: null, account: null,
      role: 'athlete', loading: false, profileLoading: false, refreshProfile: jest.fn(), signOut: jest.fn(), forceRefresh: jest.fn(), silentRefresh: jest.fn(),
    })
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: null, selectedProfileId: null, setSelectedProfileId: jest.fn(), activeArea: 'personal', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => contract }) as jest.Mock
  })

  it('renders the three authorized sections in the required order without privileged actions', async () => {
    render(<AthleteAdministrationManager />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Domanda di iscrizione' })).toBeTruthy())
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Domanda di iscrizione', 'Certificato medico', 'Situazione economica'])
    expect(screen.getByText('Da consegnare')).toBeTruthy()
    expect(screen.getByText('In scadenza')).toBeTruthy()
    expect(screen.getByText('Scadenza 20 ottobre 2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^(Paga ora|Carica certificato|Consegna domanda)$/i })).toBeNull()
  })

  it('hides denied sections while retaining the independently authorized one', async () => {
    profilesMock.mockReturnValue({ profiles: [], selectedProfileId: 'subject-1', selectedProfile: { profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null }, relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: { view_schedule: false, confirm_attendance: false, view_payments: false, view_medical_status: true, view_documents: false, sign_documents: false, receive_messages: false } } }, setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ enrollment_application: null, medical_certificate: { status: 'valid', expires_at: null }, fees: null }) }) as jest.Mock

    render(<AthleteAdministrationManager />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Certificato medico' })).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'Domanda di iscrizione' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Situazione economica' })).toBeNull()
    expect(screen.getByText('Lo stato è disponibile; la data non è visibile in questo contesto.')).toBeTruthy()
  })

  it('focuses a recognized section and ignores an unknown query-string value', async () => {
    section = 'section=certificate'
    const { rerender } = render(<AthleteAdministrationManager />)
    await waitFor(() => expect(document.activeElement?.id).toBe('administration-certificate'))

    section = 'section=unknown'
    rerender(<AthleteAdministrationManager />)
    expect(document.activeElement?.id).toBe('administration-certificate')
  })

  it('shows offline and retry states without making a request offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    render(<AthleteAdministrationManager />)
    await waitFor(() => expect(screen.getByText('Amministrazione non disponibile offline')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Domanda di iscrizione' })).toBeTruthy())
  })
})
