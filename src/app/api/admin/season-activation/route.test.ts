import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { activateSeason } from '@/server/admin/season-activation'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/admin/season-activation', () => ({
  activateSeason: jest.fn(),
  seasonActivationSchema: require('zod').object({
    activationId: require('zod').string().uuid(),
    sourceSeasonId: require('zod').string().uuid(),
    targetSeasonId: require('zod').string().uuid(),
  }).strict().refine((value: { sourceSeasonId: string; targetSeasonId: string }) => value.sourceSeasonId !== value.targetSeasonId),
}))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

const payload = {
  activationId: '11111111-1111-4111-8111-111111111111',
  sourceSeasonId: '22222222-2222-4222-8222-222222222222',
  targetSeasonId: '33333333-3333-4333-8333-333333333333',
}

function request(body: unknown) {
  return { json: async () => body } as unknown as Request
}

describe('POST /api/admin/season-activation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({})
    ;(requireGlobalRole as jest.Mock).mockResolvedValue({ authUserId: '44444444-4444-4444-8444-444444444444' })
  })

  it('requires an admin before invoking the privileged activation', async () => {
    ;(requireGlobalRole as jest.Mock).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    const response = await POST(request(payload) as never)

    expect(response.status).toBe(403)
    expect(activateSeason).not.toHaveBeenCalled()
  })

  it('passes the approved source, target and authenticated actor to the service', async () => {
    ;(activateSeason as jest.Mock).mockResolvedValue({ ...payload, activationKey: payload.activationId, activatedAt: '2026-09-28T09:30:00.000Z', replayed: false })

    const response = await POST(request(payload) as never)

    expect(response.status).toBe(200)
    expect(activateSeason).toHaveBeenCalledWith(payload, '44444444-4444-4444-8444-444444444444')
  })

  it('rejects malformed input before invoking the activation service', async () => {
    const response = await POST(request({ ...payload, targetSeasonId: payload.sourceSeasonId }) as never)

    expect(response.status).toBe(400)
    expect(activateSeason).not.toHaveBeenCalled()
  })
})
