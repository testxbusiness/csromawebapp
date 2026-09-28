import { hasDashboardData, isDashboardDataCurrent } from './dashboard-state'

const emptyDashboard = {
  activeSeason: null,
  teamCount: 0,
  eventCount: 0,
  messageCount: 0,
  feeCount: 0,
  hasNextMatch: false,
}

describe('athlete dashboard state', () => {
  it.each([
    ['zero teams and no content', emptyDashboard],
    ['one team with no content', { ...emptyDashboard, teamCount: 1 }],
    ['multiple teams with no content', { ...emptyDashboard, teamCount: 2 }],
  ])('recognizes data presence for %s', (_label, data) => {
    expect(hasDashboardData(data)).toBe(data.teamCount > 0)
  })

  it('recognizes every dashboard payload section as in-memory data', () => {
    expect(hasDashboardData({ ...emptyDashboard, activeSeason: { id: 'season-1' } })).toBe(true)
    expect(hasDashboardData({ ...emptyDashboard, eventCount: 1 })).toBe(true)
    expect(hasDashboardData({ ...emptyDashboard, messageCount: 1 })).toBe(true)
    expect(hasDashboardData({ ...emptyDashboard, feeCount: 1 })).toBe(true)
    expect(hasDashboardData({ ...emptyDashboard, hasNextMatch: true })).toBe(true)
  })

  it('does not consider a previous subject payload current', () => {
    expect(isDashboardDataCurrent('athlete-a', 'athlete-b')).toBe(false)
    expect(isDashboardDataCurrent(null, 'athlete-a')).toBe(false)
    expect(isDashboardDataCurrent('athlete-a', 'athlete-a')).toBe(true)
  })
})
