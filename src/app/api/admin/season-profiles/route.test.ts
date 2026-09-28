import { AccountContextError } from '@/server/auth/require-account-context'
import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getProfilePreview } from '@/server/admin/season-rollover-profiles'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/admin/season-rollover-profiles', () => ({ getProfilePreview: jest.fn() }))
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) } }))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
function request(url: string) { return { url } as unknown as Request }

describe('/api/admin/season-profiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({})
    ;(requireGlobalRole as jest.Mock).mockResolvedValue({ ownerProfileId: 'admin' })
  })

  it('denies non-admin without reading the preview', async () => {
    ;(requireGlobalRole as jest.Mock).mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))
    const response = await GET(request(`http://localhost/api/admin/season-profiles?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(403)
    expect(getProfilePreview).not.toHaveBeenCalled()
  })

  it('validates query ids before calling the service', async () => {
    const response = await GET(request('http://localhost/api/admin/season-profiles?sourceSeasonId=bad&targetSeasonId=bad') as never)
    expect(response.status).toBe(400)
    expect(getProfilePreview).not.toHaveBeenCalled()
  })

  it('returns the server-side read-only preview', async () => {
    ;(getProfilePreview as jest.Mock).mockResolvedValue({ athletes: [], collaborators: [] })
    const response = await GET(request(`http://localhost/api/admin/season-profiles?sourceSeasonId=${sourceSeasonId}&targetSeasonId=${targetSeasonId}`) as never)
    expect(response.status).toBe(200)
    expect(getProfilePreview).toHaveBeenCalledWith(sourceSeasonId, targetSeasonId)
  })
})
