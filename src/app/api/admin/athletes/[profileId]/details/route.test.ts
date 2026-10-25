import { GET } from './route'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'

jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

describe('GET /api/admin/athletes/[profileId]/details', () => {
  it('denies non-admin requests before creating a privileged client', async () => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    const response = await GET(
      { url: 'https://example.test/api/admin/athletes/athlete-1/details?seasonId=season-1' } as Request,
      { params: Promise.resolve({ profileId: 'athlete-1' }) },
    )

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })
})
