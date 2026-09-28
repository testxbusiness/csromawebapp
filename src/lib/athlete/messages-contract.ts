import type {
  AthleteMessageContract,
  AthleteMessageReadState,
  AthleteMessageTeam,
} from '@/types/athlete-messages'

type RawRecipient = {
  id?: string
  message_id: string
  team_id?: string | null
  profile_id?: string | null
  is_read?: boolean | null
  read_at?: string | null
}

type RawMessage = {
  id: string
  subject: string
  content: string
  created_at: string
  created_by?: string | null
  created_by_profile?: AthleteMessageContract['created_by_profile']
}

export function buildAthleteMessages(
  messages: RawMessage[],
  recipients: RawRecipient[],
  teamsById: Map<string, AthleteMessageTeam>,
  readByMessageId: Map<string, { read_at: string | null }>,
  visibleSubjectProfileId: string,
): AthleteMessageContract[] {
  const recipientsByMessage = new Map<string, RawRecipient[]>()
  for (const recipient of recipients) {
    const current = recipientsByMessage.get(recipient.message_id) ?? []
    current.push(recipient)
    recipientsByMessage.set(recipient.message_id, current)
  }

  return messages.map((message) => {
    const messageRecipients = recipientsByMessage.get(message.id) ?? []
    const teamIds = [...new Set(messageRecipients.map((r) => r.team_id).filter((id): id is string => Boolean(id)))]
    const teams = teamIds.flatMap((id) => {
      const team = teamsById.get(id)
      return team ? [team] : []
    })
    const read = readByMessageId.get(message.id)
    const readState: AthleteMessageReadState = {
      is_read: Boolean(read),
      read_at: read?.read_at ?? null,
    }

    return {
      ...message,
      dedupe_key: message.id,
      teams,
      // Keep the relation IDs even if a display lookup is unavailable.
      team_ids: teamIds,
      read_state: readState,
      is_read: readState.is_read,
      message_recipients: messageRecipients.map((recipient) => ({
        id: recipient.id ?? `${message.id}:${recipient.team_id ?? recipient.profile_id ?? 'recipient'}`,
        is_read: readState.is_read,
        read_at: readState.read_at,
        ...(recipient.team_id ? { teams: teamsById.get(recipient.team_id) ?? null } : {}),
        ...(recipient.profile_id === visibleSubjectProfileId
          ? { profiles: { id: visibleSubjectProfileId, first_name: '', last_name: '' } }
          : {}),
      })),
    }
  })
}
