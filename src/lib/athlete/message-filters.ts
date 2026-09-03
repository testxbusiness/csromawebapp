type MessageFilterItem = {
  id: string
  is_read: boolean
  teams?: Array<{ id: string }>
}

export type MessageReadFilter = 'all' | 'unread'

export function filterAthleteMessages<T extends MessageFilterItem>(
  messages: T[],
  readFilter: MessageReadFilter,
  selectedTeamId: string | null,
): T[] {
  return messages.filter((message) => {
    if (readFilter === 'unread' && message.is_read) return false
    if (selectedTeamId && !(message.teams ?? []).some((team) => team.id === selectedTeamId)) return false
    return true
  })
}
