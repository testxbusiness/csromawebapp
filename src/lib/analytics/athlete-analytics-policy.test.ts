import {
  athleteAnalyticsSection,
  isEligibleAthleteExperience,
  isAthleteAnalyticsEnabled,
  sanitizeAthleteAnalyticsProperties,
} from './athlete-analytics-policy'

const eligible = {
  userId: 'auth-1',
  account: { authUserId: 'auth-1', roles: ['athlete'] },
  role: 'athlete',
  activeArea: 'personal' as const,
  selectedProfileId: null,
  pathname: '/athlete/calendar',
  loading: false,
  profileLoading: false,
}

describe('athlete analytics policy', () => {
  it('allows only a verified personal athlete experience', () => {
    expect(isEligibleAthleteExperience(eligible)).toBe(true)
    expect(isEligibleAthleteExperience({ ...eligible, account: { authUserId: 'auth-1', roles: ['athlete', 'admin'] } })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, account: { authUserId: 'auth-1', roles: ['athlete', 'coach'] } })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, role: 'coach' })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, role: null })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, userId: null })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, selectedProfileId: 'cached-family-profile' })).toBe(true)
    expect(isEligibleAthleteExperience({ ...eligible, activeArea: 'family' })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, pathname: '/admin/incassi' })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, loading: true })).toBe(false)
    expect(isEligibleAthleteExperience({ ...eligible, account: { authUserId: 'other-account', roles: ['athlete'] } })).toBe(false)
  })

  it('maps athlete routes to a small, non-identifying section set', () => {
    expect(athleteAnalyticsSection('/dashboard')).toBe('dashboard')
    expect(athleteAnalyticsSection('/athlete/fees')).toBe('fees')
    expect(athleteAnalyticsSection('/athlete/profile/account')).toBe('profile')
    expect(athleteAnalyticsSection('/athlete/messages')).toBe('messages')
    expect(athleteAnalyticsSection('/athlete/calendar')).toBe('calendar')
    expect(athleteAnalyticsSection('/admin/atleti/uuid')).toBeNull()
  })

  it('allows analytics in production when the feature flag is enabled', () => {
    const originalEnabled = process.env.NEXT_PUBLIC_POSTHOG_ENABLED
    const originalEnvironment = process.env.NEXT_PUBLIC_ANALYTICS_ENV
    try {
      process.env.NEXT_PUBLIC_POSTHOG_ENABLED = 'true'
      process.env.NEXT_PUBLIC_ANALYTICS_ENV = 'production'
      expect(isAthleteAnalyticsEnabled()).toBe(true)
      process.env.NEXT_PUBLIC_POSTHOG_ENABLED = 'false'
      expect(isAthleteAnalyticsEnabled()).toBe(false)
    } finally {
      if (originalEnabled === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_ENABLED
      else process.env.NEXT_PUBLIC_POSTHOG_ENABLED = originalEnabled
      if (originalEnvironment === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENV
      else process.env.NEXT_PUBLIC_ANALYTICS_ENV = originalEnvironment
    }
  })

  it('allows only the documented non-sensitive event properties', () => {
    expect(sanitizeAthleteAnalyticsProperties('athlete_absence_reported', {
      scope: 'period', environment: 'preview', start_date: '2030-02-01', note: 'sensitive', event_id: 'id',
    })).toEqual({ scope: 'period', environment: 'preview' })
    expect(sanitizeAthleteAnalyticsProperties('$pageview', {
      '$current_url': 'https://example.test/athlete/fees?token=secret', page: 'fees', environment: 'preview',
      '$referrer': 'https://example.test/?token=sensitive', '$initial_current_url': 'private',
    })).toEqual({
      page: 'fees',
      environment: 'preview',
      '$current_url': 'https://example.test/analytics/fees',
      '$pathname': '/analytics/fees',
    })
    expect(sanitizeAthleteAnalyticsProperties('$pageview', { page: '/athlete/profile/child-id', environment: 'preview' }))
      .toEqual({ environment: 'preview' })
  })
})
