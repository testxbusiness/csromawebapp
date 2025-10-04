export interface UserTeam {
  id: string
  name: string
  activity_id?: string | null
  activities?: {
    name: string
  } | null
}

export interface AthleteProfile {
  membership_number?: string | null
  medical_certificate_expiry?: string | null
  personal_notes?: string | null
}

export interface CoachProfile {
  level?: string | null
  specialization?: string | null
  started_on?: string | null
}

export interface User {
  id?: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'athlete'
  roles?: string[] // Ruoli multipli
  phone?: string
  birth_date?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  last_sign_in_at?: string
  must_change_password?: boolean
  teams?: UserTeam[]
  athlete_profile?: AthleteProfile | null
  coach_profile?: CoachProfile | null
}

export interface Team {
  id: string
  name: string
  code: string
  activity_id?: string | null
  activities?: {
    name: string
  } | null
}

export interface UserFormData {
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'athlete'
  phone?: string
  birth_date?: string
  team_ids?: string[]
  team_assignments?: { team_id: string; jersey_number?: number | null }[]
  athlete_profile?: AthleteProfile | null
  coach_profile?: CoachProfile | null
}
