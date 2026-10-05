import { createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({
  AccountContextError: class AccountContextError extends Error {
    status = 401
  },
  requireAccountContext: jest.fn(),
}))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>

function profileQuery() {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return builder
}

describe('GET /api/me/profile', () => {
  it('selects and returns only the account profile contract fields', async () => {
    const query = profileQuery()
    query.maybeSingle.mockResolvedValue({
      data: {
        id: 'profile-1',
        email: 'athlete@example.test',
        first_name: 'Luca',
        last_name: 'Rossi',
        role: 'athlete',
        phone: '+39 000 000 0000',
        birth_date: '2010-01-01',
        avatar_url: null,
      },
      error: null,
    })
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue(query) } as unknown as Awaited<ReturnType<typeof createClient>>)
    accountMock.mockResolvedValue({
      authUserId: 'auth-1',
      ownerProfileId: 'profile-1',
      accountStatus: 'active',
      roles: ['athlete'],
      mustChangePassword: false,
    } as Awaited<ReturnType<typeof requireAccountContext>>)

    const response = await GET({} as Request)

    expect(query.select).toHaveBeenCalledWith('id, email, first_name, last_name, role, phone, birth_date, avatar_url')
    expect(response).toMatchObject({ status: 200, body: { profile: expect.objectContaining({ id: 'profile-1' }), account: expect.objectContaining({ ownerProfileId: 'profile-1' }) } })
  })
})
