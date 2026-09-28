import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { applyStructureChoices, getStructurePreview } from '@/server/admin/season-rollover-structures'
import { GET, POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/admin/season-rollover-structures', () => ({
  applyStructureChoices: jest.fn(),
  getStructurePreview: jest.fn(),
  structureChoiceItemSchema: require('zod').discriminatedUnion('choice', [
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('copy') }).strict(),
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('link'), targetId: require('zod').string().uuid() }).strict(),
    require('zod').object({ sourceId: require('zod').string().uuid(), choice: require('zod').literal('skip') }).strict(),
  ]),
}))
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const sourceGymId = '33333333-3333-4333-8333-333333333333'

function request(url: string, body?: unknown) {
  return { url, json: async () => body } as unknown as Request
}

describe('/api/admin/season-structures', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({})
    ;(requireGlobalRole as jest.Mock).mockResolvedValue({ ownerProfileId: 'admin' })
  })

  it('denies non-admin before preview', async () => {
    ;(requireGlobalRole as jest.Mock).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))
    const response = await GET(request(`http://localhost/api/admin/season-structures?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(403)
    expect(getStructurePreview).not.toHaveBeenCalled()
  })

  it('returns the server-side preview', async () => {
    ;(getStructurePreview as jest.Mock).mockResolvedValue({ gyms: [{ source: { id: sourceGymId }, matches: [] }], activities: [] })
    const response = await GET(request(`http://localhost/api/admin/season-structures?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(200)
    expect(getStructurePreview).toHaveBeenCalledWith(sourceSeasonId, targetSeasonId)
  })

  it('validates choices and sends the batch to the transactional service', async () => {
    ;(applyStructureChoices as jest.Mock).mockResolvedValue({ copiedGyms: 1 })
    const response = await POST(request('http://localhost/api/admin/season-structures', {
      sourceSeasonId, targetSeasonId, gyms: [{ sourceId: sourceGymId, choice: 'copy' }], activities: [],
    }) as never)
    expect(response.status).toBe(200)
    expect(applyStructureChoices).toHaveBeenCalledWith(sourceSeasonId, targetSeasonId, [{ sourceId: sourceGymId, choice: 'copy' }], [])
  })

  it('rejects cross-season-looking invalid IDs at the API boundary', async () => {
    const response = await POST(request('http://localhost/api/admin/season-structures', {
      sourceSeasonId, targetSeasonId, gyms: [{ sourceId: 'not-an-id', choice: 'copy' }], activities: [],
    }) as never)
    expect(response.status).toBe(400)
    expect(applyStructureChoices).not.toHaveBeenCalled()
  })
})
