import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyProfileBatch } from '@/server/admin/season-rollover-profile-batch'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/admin/season-rollover-profile-batch', () => ({
  applyProfileBatch: jest.fn(),
  profileBatchSchema: require('zod').object({
    batchId: require('zod').string().uuid(),
    sourceSeasonId: require('zod').string().uuid(),
    targetSeasonId: require('zod').string().uuid(),
    selections: require('zod').array(require('zod').object({
      profileId: require('zod').string().uuid(),
      included: require('zod').boolean(),
      teams: require('zod').array(require('zod').object({
        teamId: require('zod').string().uuid(),
        role: require('zod').string(),
        jerseyNumber: require('zod').number().nullable().optional(),
      }).strict()),
    }).strict()),
  }).strict(),
}))
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const batchId = '33333333-3333-4333-8333-333333333333'
const profileId = '44444444-4444-4444-8444-444444444444'
const teamId = '55555555-5555-4555-8555-555555555555'

function request(body: unknown) {
  return { json: async () => body } as unknown as Request
}

describe('/api/admin/season-profile-batch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({})
    ;(requireGlobalRole as jest.Mock).mockResolvedValue({ authUserId: '66666666-6666-4666-8666-666666666666' })
  })

  it('requires an admin before invoking the batch', async () => {
    ;(requireGlobalRole as jest.Mock).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))
    const response = await POST(request({}) as never)
    expect(response.status).toBe(403)
    expect(applyProfileBatch).not.toHaveBeenCalled()
  })

  it('sends the complete mixed selection as one server-side batch', async () => {
    const payload = {
      batchId, sourceSeasonId, targetSeasonId,
      selections: [
        { profileId, included: true, teams: [{ teamId, role: 'athlete', jerseyNumber: 12 }] },
        { profileId: '77777777-7777-4777-8777-777777777777', included: false, teams: [] },
      ],
    }
    ;(applyProfileBatch as jest.Mock).mockResolvedValue({ batchKey: batchId, included: 1, excluded: 1, withoutTeam: 0, teamMembers: 1, teamCoaches: 0, warnings: 0, replayed: false })
    const response = await POST(request(payload) as never)
    expect(response.status).toBe(200)
    expect(applyProfileBatch).toHaveBeenCalledWith(payload, '66666666-6666-4666-8666-666666666666')
  })

  it('rejects malformed input before calling the service', async () => {
    const response = await POST(request({ batchId: 'bad', sourceSeasonId, targetSeasonId, selections: [] }) as never)
    expect(response.status).toBe(400)
    expect(applyProfileBatch).not.toHaveBeenCalled()
  })
})
