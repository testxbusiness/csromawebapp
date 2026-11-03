import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AthleteAnalyticsController from './AthleteAnalyticsController'

const mockUseAuth = jest.fn()
const mockUseAccessibleProfiles = jest.fn()
const mockUsePathname = jest.fn()
const mockStart = jest.fn()
const mockStop = jest.fn()
const mockTrackPageView = jest.fn()

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/context/AccessibleProfileContext', () => ({ useAccessibleProfiles: () => mockUseAccessibleProfiles() }))
jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }))
jest.mock('@/lib/analytics/athlete-analytics', () => ({
  startAthleteAnalytics: (...args: unknown[]) => mockStart(...args),
  stopAthleteAnalytics: (...args: unknown[]) => mockStop(...args),
  trackAthletePageView: (...args: unknown[]) => mockTrackPageView(...args),
}))

const athleteAuth = {
  user: { id: 'auth-1' },
  account: { authUserId: 'auth-1', roles: ['athlete'] },
  profile: { role: 'athlete' },
  role: 'athlete',
  loading: false,
  profileLoading: false,
}

describe('AthleteAnalyticsController', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED = 'true'
    process.env.NEXT_PUBLIC_ANALYTICS_ENV = 'preview'
    window.localStorage.clear()
    mockUseAuth.mockReturnValue(athleteAuth)
    mockUseAccessibleProfiles.mockReturnValue({ activeArea: 'personal', selectedProfileId: null })
    mockUsePathname.mockReturnValue('/athlete/calendar')
    mockStart.mockReset().mockResolvedValue(true)
    mockStop.mockReset()
    mockTrackPageView.mockReset()
  })

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_ENABLED
    delete process.env.NEXT_PUBLIC_ANALYTICS_ENV
  })

  it('does not initialize or track an eligible athlete before consent', async () => {
    render(<AthleteAnalyticsController />)
    expect(await screen.findByText(/misurazione facoltativa/i)).toBeInTheDocument()
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockTrackPageView).not.toHaveBeenCalled()
  })

  it('keeps tracking disabled after the athlete refuses consent', async () => {
    render(<AthleteAnalyticsController />)
    expect(await screen.findByText(/misurazione facoltativa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }))
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockTrackPageView).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('csroma:athlete-analytics-consent:v1:auth-1')).toBe('denied')
  })

  it('tracks a consented athlete page once, despite rerenders', async () => {
    const view = render(<AthleteAnalyticsController />)
    expect(await screen.findByText(/misurazione facoltativa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Consenti analytics' }))

    await waitFor(() => expect(mockTrackPageView).toHaveBeenCalledTimes(1))
    expect(mockStart).toHaveBeenCalledWith('auth-1')
    expect(mockTrackPageView).toHaveBeenCalledWith('calendar')
    view.rerender(<AthleteAnalyticsController />)
    await Promise.resolve()
    expect(mockTrackPageView).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['administrator', { ...athleteAuth, account: { authUserId: 'auth-1', roles: ['athlete', 'admin'] }, role: 'admin' }],
    ['coach', { ...athleteAuth, account: { authUserId: 'auth-1', roles: ['athlete', 'coach'] }, role: 'coach' }],
    ['anonymous visitor', { ...athleteAuth, user: null, account: null, role: null, profile: null }],
  ])('does not offer tracking to an excluded %s', async (_label, authState) => {
    mockUseAuth.mockReturnValue(authState)
    const { container } = render(<AthleteAnalyticsController />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockTrackPageView).not.toHaveBeenCalled()
  })

  it('stops tracking when the active subject changes to a delegated profile', async () => {
    const view = render(<AthleteAnalyticsController />)
    expect(await screen.findByText(/misurazione facoltativa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Consenti analytics' }))
    await waitFor(() => expect(mockTrackPageView).toHaveBeenCalledTimes(1))

    mockUseAccessibleProfiles.mockReturnValue({ activeArea: 'family', selectedProfileId: 'child-profile' })
    view.rerender(<AthleteAnalyticsController />)
    await waitFor(() => expect(mockStop).toHaveBeenCalled())
  })

  it('supports consent revocation', async () => {
    render(<AthleteAnalyticsController />)
    expect(await screen.findByText(/misurazione facoltativa/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Consenti analytics' }))
    await waitFor(() => expect(mockStart).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Revoca consenso' }))
    expect(mockStop).toHaveBeenCalled()
    expect(window.localStorage.getItem('csroma:athlete-analytics-consent:v1:auth-1')).toBe('denied')
  })
})
