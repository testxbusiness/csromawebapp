import { render, screen } from '@testing-library/react'
import FamilyMemberDashboard from './FamilyMemberDashboard'

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'account-1' } }) }))
const profilesMock = jest.fn()
jest.mock('@/context/AccessibleProfileContext', () => ({ useAccessibleProfiles: () => profilesMock() }))

describe('FamilyMemberDashboard', () => {
  it('shows human-readable sections without exposing permission keys', () => {
    profilesMock.mockReturnValue({
      profiles: [
        {
          profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null },
          relationship: {
            type: 'parent',
            permissions: {
              view_schedule: true, confirm_attendance: true, view_payments: false,
              view_medical_status: false, view_documents: false, sign_documents: false,
              receive_messages: true,
            },
          },
        },
        {
          profile: { id: 'child-2', first_name: 'Anna', last_name: 'Rossi', email: null },
          relationship: {
            type: 'guardian',
            permissions: {
              view_schedule: false, confirm_attendance: false, view_payments: true,
              view_medical_status: false, view_documents: false, sign_documents: false,
              receive_messages: false,
            },
          },
        },
      ],
      selectedProfile: null,
      setSelectedProfileId: jest.fn(),
      setActiveArea: jest.fn(),
      loading: false,
      profilesLoaded: true,
      error: null,
      refresh: jest.fn(),
    })

    render(<FamilyMemberDashboard />)

    expect(screen.getByRole('heading', { name: 'Area familiare' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apri profilo di Luca Rossi' })).toBeTruthy()
    expect(screen.getByText(/Calendario e campionato, Conferma presenze, Messaggi/)).toBeTruthy()
    expect(screen.getByText('Sezioni disponibili: Quote associative')).toBeTruthy()
    expect(screen.queryByText(/view_schedule|receive_messages|view_payments/)).toBeNull()
  })
})
