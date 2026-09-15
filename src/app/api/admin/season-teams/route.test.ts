import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyTeamChoices, getTeamPreview } from '@/server/admin/season-rollover-teams'
import { GET, POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/admin/season-rollover-teams', () => ({
  applyTeamChoices: jest.fn(),
  getTeamPreview: jest.fn(),
  teamChoicesSchema: require('zod').array(require('zod').discriminatedUnion('choice', [
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('create'), name: require('zod').string(), code: require('zod').string(), activityId: require('zod').string().uuid() }).strict(),
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('link'), targetId: require('zod').string().uuid() }).strict(),
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('skip') }).strict(),
  ])),
}))
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const sourceTeamId = '33333333-3333-4333-8333-333333333333'
const targetTeamId = '44444444-4444-4444-8444-444444444444'
const activityId = '55555555-5555-4555-8555-555555555555'

function request(url: string, body?: unknown) {
  return { url, json: async () => body } as unknown as Request
}

describe('/api/admin/season-teams', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({})
    ;(requireGlobalRole as jest.Mock).mockResolvedValue({ ownerProfileId: 'admin' })
  })

  it('denies non-admin before preview', async () => {
    ;(requireGlobalRole as jest.Mock).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))
    const response = await GET(request(`http://localhost/api/admin/season-teams?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(403)
    expect(getTeamPreview).not.toHaveBeenCalled()
  })

  it('returns the server-side team preview', async () => {
    ;(getTeamPreview as jest.Mock).mockResolvedValue({ teams: [], targetTeams: [] })
    const response = await GET(request(`http://localhost/api/admin/season-teams?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(200)
    expect(getTeamPreview).toHaveBeenCalledWith(sourceSeasonId, targetSeasonId)
  })

  it('accepts create, link and skip choices and sends one batch', async () => {
    ;(applyTeamChoices as jest.Mock).mockResolvedValue({ created: 1, linked: 1, skipped: 1 })
    const teams = [
      { sourceId: sourceTeamId, choice: 'create', name: 'U16 - 2627', code: 'U16-2627', activityId },
      { sourceId: targetTeamId, choice: 'link', targetId: targetTeamId },
      { sourceId: activityId, choice: 'skip' },
    ]
    const response = await POST(request('http://localhost/api/admin/season-teams', { sourceSeasonId, targetSeasonId, teams }) as never)
    expect(response.status).toBe(200)
    expect(applyTeamChoices).toHaveBeenCalledWith(sourceSeasonId, targetSeasonId, teams)
  })

  it('rejects malformed choices before calling the service', async () => {
    const response = await POST(request('http://localhost/api/admin/season-teams', { sourceSeasonId, targetSeasonId, teams: [{ sourceId: 'not-an-id', choice: 'skip' }] }) as never)
    expect(response.status).toBe(400)
    expect(applyTeamChoices).not.toHaveBeenCalled()
  })
})
