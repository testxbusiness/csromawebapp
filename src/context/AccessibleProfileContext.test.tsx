import { act, render, screen, waitFor } from '@testing-library/react'
import { AccessibleProfileProvider, useAccessibleProfiles } from './AccessibleProfileContext'

const authMock = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => authMock() }))

const oneProfile = {
  profile: { id: 'child-1', first_name: 'Luca', last_name: 'Rossi', email: null },
  relationship: {
    id: 'relationship-1', type: 'parent', verified_at: '2026-01-01',
    permissions: {
      view_schedule: true, confirm_attendance: false, view_payments: false,
      view_medical_status: false, view_documents: false, sign_documents: false,
      receive_messages: false,
    },
  },
}

function Probe() {
  const context = useAccessibleProfiles()
  return <><output data-testid="selected">{context.selectedProfileId ?? ''}</output><output data-testid="area">{context.activeArea}</output><button type="button" onClick={() => context.setActiveArea('family')}>Famiglia</button></>
}

describe('AccessibleProfileProvider initial family selection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    authMock.mockReturnValue({
      account: { authUserId: 'account-1', roles: ['athlete', 'family_member'] },
      user: { id: 'auth-1' },
      loading: false,
    })
  })

  it('auto-selects the only profile only after family area activation', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [oneProfile] }) }) as jest.Mock
    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe(''))
    act(() => screen.getByRole('button', { name: 'Famiglia' }).click())
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('child-1'))
    expect(window.localStorage.getItem('csroma_active_subject_profile_id')).toBe('child-1')
  })

  it('leaves multiple profiles unselected for explicit user choice', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [oneProfile, { ...oneProfile, profile: { ...oneProfile.profile, id: 'child-2', first_name: 'Anna' } }] }) }) as jest.Mock
    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)
    act(() => screen.getByRole('button', { name: 'Famiglia' }).click())
    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe(''))
    expect(window.localStorage.getItem('csroma_active_subject_profile_id')).toBeNull()
  })

  it('restores the active family area across a full navigation', async () => {
    window.localStorage.setItem('csroma_active_area', 'family')
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [oneProfile, { ...oneProfile, profile: { ...oneProfile.profile, id: 'child-2', first_name: 'Anna' } }] }) }) as jest.Mock

    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe(''))
    expect(window.localStorage.getItem('csroma_active_area')).toBe('family')
  })

  it('returns an athlete without family access to personal area after a previous family login', async () => {
    window.localStorage.setItem('csroma_active_area', 'family')
    window.localStorage.setItem('csroma_active_subject_profile_id', 'child-1')
    authMock.mockReturnValue({
      account: { authUserId: 'athlete-account', roles: ['athlete'] },
      user: { id: 'athlete-account' },
      loading: false,
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [] }) }) as jest.Mock

    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)

    await waitFor(() => expect(screen.getByTestId('area').textContent).toBe('personal'))
    expect(screen.getByTestId('selected').textContent).toBe('')
    expect(window.localStorage.getItem('csroma_active_area')).toBe('personal')
    expect(window.localStorage.getItem('csroma_active_subject_profile_id')).toBeNull()
  })

  it('preserves family area for an athlete with an accessible relationship even without the family role', async () => {
    window.localStorage.setItem('csroma_active_area', 'family')
    authMock.mockReturnValue({
      account: { authUserId: 'athlete-account', roles: ['athlete'] },
      user: { id: 'athlete-account' },
      loading: false,
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [oneProfile] }) }) as jest.Mock

    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('child-1'))
    expect(screen.getByTestId('area').textContent).toBe('family')
  })

  it('opens family area for a family-only account with no saved preference', async () => {
    authMock.mockReturnValue({
      account: { authUserId: 'family-account', roles: ['family_member'] },
      user: { id: 'family-account' },
      loading: false,
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profiles: [oneProfile] }) }) as jest.Mock

    render(<AccessibleProfileProvider><Probe /></AccessibleProfileProvider>)

    await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('child-1'))
    expect(screen.getByTestId('area').textContent).toBe('family')
  })
})
