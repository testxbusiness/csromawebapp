import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  const renderWithQueryClient = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}><BottomNavigation /></QueryClientProvider>)
  }

  beforeEach(() => {
    authMock.mockReturnValue({ role: 'athlete', user: { id: 'auth-1' }, account: { authUserId: 'auth-1', ownerProfileId: 'athlete-1' } })
    profilesMock.mockReturnValue({ activeArea: 'personal', selectedProfileId: null, selectedProfile: null })
  })
  afterEach(() => { delete (globalThis as { fetch?: unknown }).fetch })

  it('updates the unread badge after a confirmed read event', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ unreadMessageCount: 2 }) } as Response)
    globalThis.fetch = fetchMock

    renderWithQueryClient()
    await waitFor(() => expect(screen.getByLabelText('2 messaggi non letti')).toBeTruthy())

    await act(async () => {
      window.dispatchEvent(new CustomEvent(MESSAGE_READ_STATE_CHANGED_EVENT, {
        detail: { messageId: 'm1', subjectProfileId: null, isRead: true, readAt: '2026-10-08T10:01:00.000Z' },
      }))
    })

    await waitFor(() => expect(screen.getByLabelText('1 messaggi non letti')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  }, 15_000)

  it('does not update the unread badge for an unconfirmed read event', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadMessageCount: 2 }) } as Response)
    globalThis.fetch = fetchMock

    renderWithQueryClient()
    await waitFor(() => expect(screen.getByLabelText('2 messaggi non letti')).toBeTruthy())

    await act(async () => {
      window.dispatchEvent(new CustomEvent(MESSAGE_READ_STATE_CHANGED_EVENT, {
        detail: { messageId: 'm1', subjectProfileId: null, isRead: false },
      }))
      window.dispatchEvent(new CustomEvent(MESSAGE_READ_STATE_CHANGED_EVENT, {
        detail: { messageId: 'm2', subjectProfileId: null },
      }))
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByLabelText('2 messaggi non letti')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows only permitted family destinations for the selected athlete', async () => {
    authMock.mockReturnValue({ role: 'family_member', user: { id: 'auth-1' }, account: { authUserId: 'auth-1', ownerProfileId: 'owner-1' } })
    profilesMock.mockReturnValue({
      activeArea: 'family',
      selectedProfileId: 'athlete-1',
      selectedProfile: { relationship: { permissions: { view_schedule: true, receive_messages: true, view_payments: false } } },
    })
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ is_read: false }] }) } as Response)

    renderWithQueryClient()

    expect(screen.getByRole('link', { name: 'Oggi' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Calendario' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Messaggi/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Amministrazione' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Campionato' })).toBeTruthy()
    expect(screen.getByRole('navigation').getAttribute('data-item-count')).toBe('5')
  })

  it('exposes the canonical coach destinations on mobile', () => {
    authMock.mockReturnValue({ role: 'coach', user: { id: 'coach-1' } })

    renderWithQueryClient()

    expect(screen.getByRole('link', { name: 'Oggi' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getByRole('link', { name: 'Calendario' }).getAttribute('href')).toBe('/coach/calendar')
    expect(screen.getByRole('link', { name: 'Convocazioni' }).getAttribute('href')).toBe('/coach/campionati')
    expect(screen.getByRole('link', { name: 'Messaggi' }).getAttribute('href')).toBe('/coach/messages')
    expect(screen.getByRole('link', { name: 'Altro' }).getAttribute('href')).toBe('/coach/profile')
    expect(screen.getByRole('navigation').getAttribute('aria-label')).toBe('Navigazione coach')
  })
})
