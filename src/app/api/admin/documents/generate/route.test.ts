import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/seasons/active-season', () => ({ resolveActiveSeason: jest.fn(), resolveActiveSeasonTeamIds: jest.fn() }))
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) } }))

const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>
const resolveActiveSeasonMock = resolveActiveSeason as jest.MockedFunction<typeof resolveActiveSeason>
const resolveActiveSeasonTeamIdsMock = resolveActiveSeasonTeamIds as jest.MockedFunction<typeof resolveActiveSeasonTeamIds>

const activeTeamId = '11111111-1111-4111-8111-111111111111'
const historicalTeamId = '22222222-2222-4222-8222-222222222222'

function request(teamId: string) {
  return {
    json: async () => ({
      name: 'Convocazione', title: 'Convocazione U14', type: 'team_convocation', document_type: 'team_convocation', status: 'generated',
      generated_content_html: '<p>Contenuto</p>', team_id: teamId, target_team_id: teamId, target_user_id: null,
    }),
  } as unknown as Request
}

describe('POST /api/admin/documents/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({ ownerProfileId: 'admin' } as Awaited<ReturnType<typeof requireGlobalRole>>)
    createAdminClientMock.mockReturnValue({} as ReturnType<typeof createAdminClient>)
    resolveActiveSeasonMock.mockResolvedValue({ id: 'season-active', name: 'Attiva', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true })
  })

  it('rejects a historical team before inserting a document', async () => {
    resolveActiveSeasonTeamIdsMock.mockResolvedValue([activeTeamId])

    const response = await POST(request(historicalTeamId))

    expect(response.status).toBe(400)
    expect((response as unknown as { body: { error: string } }).body.error).toContain('stagione attiva')
  })

  it('persists a document for an active-season team', async () => {
    resolveActiveSeasonTeamIdsMock.mockResolvedValue([activeTeamId])
    const single = jest.fn().mockResolvedValue({ data: { id: 'document-id' }, error: null })
    const select = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select })
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue({ insert }) } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(request(activeTeamId))

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ target_team_id: activeTeamId, created_by: 'admin' }))
  })
})
