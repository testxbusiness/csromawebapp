import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import type { AthleteFeeInstallment } from '@/types/athlete-fees'
import AthleteFeesManager from './AthleteFeesManager'

jest.mock('@/hooks/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string, subjectProfileId?: string | null) => subjectProfileId ? `${url}?subjectProfileId=${subjectProfileId}` : url,
  useAccessibleProfiles: jest.fn(),
}))

const authMock = useAuth as jest.MockedFunction<typeof useAuth>
const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>

const makeInstallment = (id: string, teamId: string, teamName: string, status: AthleteFeeInstallment['status']): AthleteFeeInstallment => ({
  id, installment_number: 1, due_date: '2026-09-10', amount: 100, status,
  financials: { due_amount: 100, paid_amount: status === 'paid' ? 100 : 0, remaining_amount: status === 'paid' ? 0 : 100 },
  membership_fee: {
    id: `fee-${id}`, name: `Quota ${teamName}`, total_amount: 100, enrollment_fee: 0, insurance_fee: 0,
    monthly_fee: 100, months_count: 1, installments_count: 1, team_id: teamId, activity_id: 'activity-1',
    team: { id: teamId, name: teamName, code: teamName, activity: { id: 'activity-1', name: 'Volley' } },
  },
})

describe('AthleteFeesManager', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    authMock.mockReturnValue({
      user: { id: 'user-1' } as ReturnType<typeof useAuth>['user'], session: null, profile: null, account: null,
      role: 'athlete', loading: false, profileLoading: false, refreshProfile: jest.fn(), signOut: jest.fn(),
      forceRefresh: jest.fn(), silentRefresh: jest.fn(),
    })
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: null, selectedProfileId: null, setSelectedProfileId: jest.fn(), activeArea: 'personal', setActiveArea: jest.fn(), loading: false, error: null, refresh: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ installments: [makeInstallment('one', 'team-1', 'U16', 'due_soon'), makeInstallment('two', 'team-2', 'U18', 'paid')] }),
    }) as jest.Mock
  })

  it('shows totals and keeps installments grouped by team', async () => {
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('Situazione economica')).toBeTruthy())
    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText('U18')).toBeTruthy()
    expect(screen.getByText('200,00 €')).toBeTruthy()
    expect(screen.getAllByText('100,00 €').length).toBeGreaterThan(1)
    expect(screen.queryByRole('button', { name: /^Paga$/i })).toBeNull()
  })

  it('filters paid installments and exposes a filtered empty state', async () => {
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('Situazione economica')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Pagate 1/i }))
    expect(screen.getByText('U18')).toBeTruthy()
    expect(screen.queryByText('U16')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Scadute 0/i }))
    expect(screen.getByText('Nessuna rata per questo filtro')).toBeTruthy()
  })

  it('renders an honest empty state when the authorized athlete has no fees', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ installments: [] }) }) as jest.Mock
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('Nessuna quota associativa trovata')).toBeTruthy())
    expect(screen.getByText('Totale dovuto')).toBeTruthy()
    expect(screen.getAllByText(/0,00/)).toHaveLength(3)
  })

  it('shows an offline state before requesting fees without a connection', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('Quote non disponibili offline')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps overdue and partially paid statuses visible per installment', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ installments: [
        makeInstallment('overdue', 'team-1', 'U16', 'overdue'),
        { ...makeInstallment('partial', 'team-2', 'U18', 'partially_paid'), financials: { due_amount: 100, paid_amount: 40, remaining_amount: 60 } },
      ] }),
    }) as jest.Mock
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('Scaduta')).toBeTruthy())
    expect(screen.getByText('Parziale')).toBeTruthy()
    expect(screen.getByText((_, element) => element?.textContent?.replace(/\u00a0/g, ' ') === 'residuo 60,00 €')).toBeTruthy()
  })

  it('keeps loaded fees visible offline and retries when the connection returns', async () => {
    render(<AthleteFeesManager />)
    await waitFor(() => expect(screen.getByText('U16')).toBeTruthy())

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    fireEvent(window, new Event('offline'))
    expect(screen.getByText('Quote non aggiornate')).toBeTruthy()
    expect(screen.getByText('U16')).toBeTruthy()

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    await waitFor(() => expect(screen.queryByText('Quote non aggiornate')).toBeNull())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('loads only the selected family subject fees and keeps the account context in the request', async () => {
    profilesMock.mockReturnValue({
      profiles: [],
      selectedProfileId: 'subject-1',
      selectedProfile: {
        profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: {
          view_schedule: false, confirm_attendance: false, view_payments: true,
          view_medical_status: false, view_documents: false, sign_documents: false,
          receive_messages: false,
        } },
      },
      setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(),
      loading: false, error: null, refresh: jest.fn(),
    })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ installments: [makeInstallment('subject-fee', 'team-subject', 'Luca U16', 'due_soon')] }),
    }) as jest.Mock

    render(<AthleteFeesManager />)

    await waitFor(() => expect(screen.getByText('Luca U16')).toBeTruthy())
    expect(screen.queryByText('Other child U18')).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/athlete/fees?subjectProfileId=subject-1', expect.objectContaining({ cache: 'no-store' }))
  })

  it('shows denied state for a family subject without view_payments before loading fees', async () => {
    profilesMock.mockReturnValue({
      profiles: [], selectedProfileId: 'subject-1',
      selectedProfile: {
        profile: { id: 'subject-1', first_name: 'Luca', last_name: 'Rossi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: null, permissions: {
          view_schedule: true, confirm_attendance: false, view_payments: false,
          view_medical_status: false, view_documents: false, sign_documents: false,
          receive_messages: false,
        } },
      },
      setSelectedProfileId: jest.fn(), activeArea: 'family', setActiveArea: jest.fn(),
      loading: false, error: null, refresh: jest.fn(),
    })
    global.fetch = jest.fn() as jest.Mock

    render(<AthleteFeesManager />)

    await waitFor(() => expect(screen.getByText('Accesso non abilitato')).toBeTruthy())
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
