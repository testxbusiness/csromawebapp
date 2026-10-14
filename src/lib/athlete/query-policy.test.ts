import { athleteQueryPolicy } from './query-policy'

describe('athlete query freshness policy', () => {
  it('keeps low-frequency data cached for a long session and out of focus refreshes', () => {
    expect(athleteQueryPolicy.profile).toMatchObject({
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
    })
    expect(athleteQueryPolicy.championshipCatalog.staleTime).toBe(30 * 60 * 1000)
  })

  it('keeps high-frequency message surfaces responsive to focus and reconnect', () => {
    expect(athleteQueryPolicy.messagesList).toMatchObject({
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    })
    expect(athleteQueryPolicy.unreadMessages.staleTime).toBe(15 * 1000)
  })

  it('uses targeted event-driven freshness without forcing global refreshes', () => {
    expect(athleteQueryPolicy.eventDetail.refetchOnWindowFocus).toBe(true)
    expect(athleteQueryPolicy.eventDetail.refetchOnReconnect).toBe(true)
    expect(athleteQueryPolicy.dashboardAlerts.refetchOnWindowFocus).toBe(false)
  })
})
