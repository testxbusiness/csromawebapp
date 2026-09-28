import { createAdminClient } from '@/lib/supabase/server'
import { activateSeason } from './season-activation'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn() }))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const activationId = '33333333-3333-4333-8333-333333333333'
const actorId = '44444444-4444-4444-8444-444444444444'

describe('season activation service', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects matching source and target before calling the database', async () => {
    await expect(activateSeason({ activationId, sourceSeasonId, targetSeasonId: sourceSeasonId }, actorId)).rejects.toThrow('Source e target')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('sends only validated IDs and the authenticated actor to the privileged RPC', async () => {
    const result = {
      activationKey: activationId,
      sourceSeasonId,
      targetSeasonId,
      activatedAt: '2026-09-28T09:30:00.000Z',
      replayed: false,
    }
    const rpc = jest.fn().mockResolvedValue({ data: result, error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({ rpc })

    await expect(activateSeason({ activationId, sourceSeasonId, targetSeasonId }, actorId)).resolves.toEqual(result)

    expect(rpc).toHaveBeenCalledWith('activate_season_atomically', {
      p_activation_key: activationId,
      p_source_season_id: sourceSeasonId,
      p_target_season_id: targetSeasonId,
      p_performed_by_auth_user_id: actorId,
    })
  })
})
