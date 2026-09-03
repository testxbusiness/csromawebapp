import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AthleteDashboard from './AthleteDashboard'
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
