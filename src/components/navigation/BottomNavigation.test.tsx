import { act, render, screen, waitFor } from '@testing-library/react'
import { BottomNavigation } from './BottomNavigation'
import { MESSAGE_READ_STATE_CHANGED_EVENT } from '@/lib/messages/read-state-events'

jest.mock('next/navigation', () => ({ usePathname: () => '/athlete/messages' }))
const authMock = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => authMock() }))
const profilesMock = jest.fn()
jest.mock('@/context/AccessibleProfileContext', () => ({
  appendSubjectProfile: (url: string) => url,
  useAccessibleProfiles: () => profilesMock(),
}))

describe('BottomNavigation', () => {
  beforeEach(() => {
    authMock.mockReturnValue({ role: 'athlete', user: { id: 'auth-1' } })
    profilesMock.mockReturnValue({ activeArea: 'personal', selectedProfileId: null, selectedProfile: null })
  })
  afterEach(() => { delete (globalThis as { fetch?: unknown }).fetch })

  it('refreshes and removes the unread badge after a confirmed read event', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ is_read: false }, { is_read: false }] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ is_read: true }, { is_read: true }] }) } as Response)
    globalThis.fetch = fetchMock

    render(<BottomNavigation />)
    await waitFor(() => expect(screen.getByLabelText('2 messaggi non letti')).toBeTruthy())

    await act(async () => {
      window.dispatchEvent(new CustomEvent(MESSAGE_READ_STATE_CHANGED_EVENT, {
        detail: { messageId: 'm1', subjectProfileId: null },
      }))
    })

    await waitFor(() => expect(screen.queryByLabelText('2 messaggi non letti')).toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 15_000)

  it('shows only permitted family destinations for the selected athlete', async () => {
    authMock.mockReturnValue({ role: 'family_member', user: { id: 'auth-1' } })
    profilesMock.mockReturnValue({
      activeArea: 'family',
      selectedProfileId: 'athlete-1',
      selectedProfile: { relationship: { permissions: { view_schedule: true, receive_messages: true, view_payments: false } } },
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ is_read: false }] }) } as Response)

    render(<BottomNavigation />)

    expect(screen.getByRole('link', { name: 'Oggi' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Calendario' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Messaggi/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Quote' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Campionato' })).toBeTruthy()
    expect(screen.getByRole('navigation').getAttribute('data-item-count')).toBe('5')
  })

  it('exposes the canonical coach destinations on mobile', () => {
    authMock.mockReturnValue({ role: 'coach', user: { id: 'coach-1' } })

    render(<BottomNavigation />)

    expect(screen.getByRole('link', { name: 'Oggi' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getByRole('link', { name: 'Calendario' }).getAttribute('href')).toBe('/coach/calendar')
    expect(screen.getByRole('link', { name: 'Convocazioni' }).getAttribute('href')).toBe('/coach/campionati')
    expect(screen.getByRole('link', { name: 'Messaggi' }).getAttribute('href')).toBe('/coach/messages')
    expect(screen.getByRole('link', { name: 'Altro' }).getAttribute('href')).toBe('/coach/profile')
    expect(screen.getByRole('navigation').getAttribute('aria-label')).toBe('Navigazione coach')
  })
})
