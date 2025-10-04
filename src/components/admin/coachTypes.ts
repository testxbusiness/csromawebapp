export interface Coach {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  birth_date?: string
  level?: string
  specialization?: string
  started_on?: string
  created_at: string
  updated_at: string
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
  type: 'assign_to_team' | 'remove_from_team' | 'update_staff_role'
  target_coaches: string[]
  parameters: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export interface CoachAssignment {
  coach_id: string
  team_id: string
  role: 'head_coach' | 'assistant_coach'
  assigned_at: string
  ended_on?: string
  created_at: string
}