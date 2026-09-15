import { createAdminClient } from '@/lib/supabase/server'
import { applyProfileBatch } from './season-rollover-profile-batch'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn() }))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const batchId = '33333333-3333-4333-8333-333333333333'
const profileId = '44444444-4444-4444-8444-444444444444'
const teamId = '55555555-5555-4555-8555-555555555555'
const actorId = '66666666-6666-4666-8666-666666666666'

describe('season rollover profile batch service', () => {
  it('validates duplicate profiles and does not call the database', async () => {
    const input = {
      batchId, sourceSeasonId, targetSeasonId,
      selections: [
        { profileId, included: true, teams: [] },
        { profileId, included: false, teams: [] },
      ],
    }
    await expect(applyProfileBatch(input, actorId)).rejects.toThrow('Profilo duplicato')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('calls the privileged RPC with actor and only the validated payload', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { batchKey: batchId, included: 1, excluded: 0, withoutTeam: 0, teamMembers: 1, teamCoaches: 0, warnings: 0, replayed: false }, error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({ rpc })
    const input = { batchId, sourceSeasonId, targetSeasonId, selections: [{ profileId, included: true, teams: [{ teamId, role: 'athlete', jerseyNumber: 9 }] }] }
    await expect(applyProfileBatch(input, actorId)).resolves.toMatchObject({ included: 1, teamMembers: 1 })
    expect(rpc).toHaveBeenCalledWith('rollover_profiles_batch', {
      p_batch_key: batchId,
      p_source_season_id: sourceSeasonId,
      p_target_season_id: targetSeasonId,
      p_performed_by_auth_user_id: actorId,
      p_selections: input.selections,
    })
  })
})
