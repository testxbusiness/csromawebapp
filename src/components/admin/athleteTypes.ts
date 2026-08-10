export interface Athlete {
  id: string
  email: string | null
  first_name: string
  last_name: string
  phone?: string
  birth_date?: string
  membership_number?: string
  medical_certificate_expiry?: string
  personal_notes?: string
  created_at: string
  updated_at: string
  season_ids?: string[]
  account?: {
    status: string
    roles: string[]
  } | null
}

export interface AthleteCreateData {
  id?: string
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  birth_date?: string | null
  season_id: string
  membership_number?: string | null
  medical_certificate_expiry?: string | null
  personal_notes?: string | null
  team_ids?: string[]
  jersey_numbers?: Record<string, number | null>
}

export interface Team {
  id: string
  name: string
  code: string
  activity_id?: string
  activity?: {
    name: string
  }
}

export interface Activity {
  id: string
  name: string
  season_id?: string
}

export interface Season {
  id: string
  name: string
  is_active: boolean
  start_date: string
  end_date: string
}

export interface BulkOperation {
  id: string
  type: 'assign_to_team' | 'remove_from_team' | 'update_jersey' | 'update_medical_expiry'
  target_athletes: string[]
  parameters: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export interface AthleteAssignment {
  athlete_id: string
  team_id: string
  jersey_number?: string
  started_on: string
  ended_on?: string
  created_at: string
}
