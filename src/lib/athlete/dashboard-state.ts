export type DashboardStatus = 'loading' | 'refreshing' | 'success' | 'error' | 'offline' | 'denied'

export type DashboardDataPresence = {
  activeSeason: unknown
  teamCount: number
  eventCount: number
  messageCount: number
  feeCount: number
  hasNextMatch: boolean
}

export function hasDashboardData(data: DashboardDataPresence) {
  return Boolean(
    data.activeSeason ||
    data.teamCount ||
    data.eventCount ||
    data.messageCount ||
    data.feeCount ||
    data.hasNextMatch,
  )
}

export function isDashboardDataCurrent(dataSubjectKey: string | null, subjectKey: string | null) {
  return dataSubjectKey !== null && dataSubjectKey === subjectKey
}
