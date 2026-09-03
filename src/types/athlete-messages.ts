export interface AthleteMessageTeam {
  id: string
  name: string
  code?: string | null
}

/** Read state is always scoped to the authenticated account and active subject. */
export interface AthleteMessageReadState {
  is_read: boolean
  read_at: string | null
}

export interface AthleteMessageContract {
  /** Stable identity used to collapse direct + team recipient rows. */
  id: string
  dedupe_key: string
  subject: string
  content: string
  created_at: string
  created_by?: string | null
  created_by_profile?: { first_name?: string | null; last_name?: string | null; role?: string | null } | null
  from?: string
  teams: AthleteMessageTeam[]
  team_ids: string[]
  read_state: AthleteMessageReadState
  /** Kept for existing dashboard/list consumers during the additive migration. */
  is_read: boolean
  message_recipients?: Array<{
    id: string
    is_read: boolean
    read_at: string | null
    teams?: AthleteMessageTeam | null
    profiles?: { id: string; first_name: string; last_name: string } | null
  }>
  attachments?: Array<{
    id: string
    file_name: string
    mime_type?: string | null
    file_size?: number | null
    download_url?: string | null
  }>
}

export interface AthleteMessagesContract {
  messages: AthleteMessageContract[]
  /** Explicitly identifies the context used to compute read_state without exposing auth IDs. */
  read_state_scope: 'account_subject'
}
