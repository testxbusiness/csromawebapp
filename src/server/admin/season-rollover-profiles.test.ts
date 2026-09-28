import { createAdminClient } from '@/lib/supabase/server'
import { getProfilePreview } from './season-rollover-profiles'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn() }))
const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const athleteId = '33333333-3333-4333-8333-333333333333'
const coachId = '44444444-4444-4444-8444-444444444444'
const staffId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sourceTeamA = '55555555-5555-4555-8555-555555555555'
const sourceTeamB = '66666666-6666-4666-8666-666666666666'
const targetTeamA = '77777777-7777-4777-8777-777777777777'
const targetTeamB = '88888888-8888-4888-8888-888888888888'
const activitySource = '99999999-9999-4999-8999-999999999999'
const activityTarget = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
type Row = Record<string, unknown>
function query(data: Row[] | Row | null, error: null = null) { const builder = { select: () => builder, eq: () => builder, in: () => builder, maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }), then: (resolve: (value: { data: Row[] | Row | null; error: null }) => unknown) => Promise.resolve({ data, error }).then(resolve) }; return builder }

describe('season rollover profile preview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminClient as jest.Mock).mockReturnValue({ from: (table: string) => {
      if (table === 'seasons') return query({ id: sourceSeasonId, is_active: false })
      if (table === 'season_profiles') return query([{ profile_id: athleteId, profile_type: 'athlete', status: 'active' }, { profile_id: coachId, profile_type: 'coach', status: 'active' }, { profile_id: staffId, profile_type: 'staff', status: 'inactive' }])
      if (table === 'activities') return query([{ id: activitySource, season_id: sourceSeasonId }, { id: activityTarget, season_id: targetSeasonId }])
      if (table === 'season_rollover_team_maps') return query([{ source_team_id: sourceTeamA, target_team_id: targetTeamA }])
      if (table === 'profiles') return query([{ id: athleteId, first_name: 'Ada', last_name: 'Atleta' }, { id: coachId, first_name: 'Carlo', last_name: 'Coach' }, { id: staffId, first_name: 'Sofia', last_name: 'Staff' }])
      if (table === 'teams') return query([{ id: sourceTeamA, name: 'U16', code: 'U16', activity_id: activitySource }, { id: sourceTeamB, name: 'U18', code: 'U18', activity_id: activitySource }, { id: targetTeamA, name: 'U16 2627', code: 'U16-2627', activity_id: activityTarget }, { id: targetTeamB, name: 'U18 2627', code: 'U18-2627', activity_id: activityTarget }])
      if (table === 'team_members') return query([{ profile_id: athleteId, team_id: sourceTeamA, role: 'athlete', jersey_number: 10 }, { profile_id: athleteId, team_id: sourceTeamB, role: 'athlete', jersey_number: 7 }])
      if (table === 'team_coaches') return query([{ coach_id: coachId, team_id: sourceTeamA, role: 'head_coach' }])
      if (table === 'profile_relationships') return query([{ source_profile_id: coachId, target_profile_id: athleteId, relationship_type: 'parent', status: 'active', valid_from: '2020-01-01', valid_until: null, can_view_schedule: true, can_confirm_attendance: false, can_view_payments: true, can_view_medical_status: false, can_view_documents: false, can_sign_documents: false, can_receive_messages: true }])
      return query([])
    } })
  })

  it('keeps multi-team athlete memberships, separates collaborator, and derives family context', async () => {
    const preview = await getProfilePreview(sourceSeasonId, targetSeasonId)
    expect(preview.athletes).toHaveLength(1)
    expect(preview.athletes[0].sourceTeams).toHaveLength(2)
    expect(preview.athletes[0].targetTeams).toHaveLength(1)
    expect(preview.athletes[0].family[0].permissions).toEqual(['view_schedule', 'view_payments', 'receive_messages'])
    expect(preview.collaborators[0].profile.id).toBe(coachId)
    expect(preview.athletes[0].warnings.map((item) => item.code)).toContain('mapping_missing')
  })

  it('reports target enrollment and no team without mutating data', async () => {
    const preview = await getProfilePreview(sourceSeasonId, targetSeasonId)
    expect(preview.collaborators.find((item) => item.profile.id === staffId)?.warnings.map((item) => item.code)).toEqual(expect.arrayContaining(['no_team', 'inactive_profile']))
    expect(JSON.stringify(preview)).not.toContain('auth_user_id')
    expect(JSON.stringify(preview)).not.toContain('medical')
    expect(createAdminClient).toHaveBeenCalledTimes(1)
  })
})
