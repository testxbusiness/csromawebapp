import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAccountContext } from './require-account-context'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/server/seasons/active-season', () => ({
  resolveActiveSeason: jest.fn(),
}))

function createFakeClient() {
  const auth = {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'auth-1' } },
      error: null,
    }),
  }

  const from = jest.fn((table: string) => {
    if (table === 'app_accounts') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                auth_user_id: 'auth-1',
                owner_profile_id: 'profile-1',
                status: 'active',
                must_change_password: false,
              },
              error: null,
            }),
          }),
        }),
      }
    }

    return {
      select: () => ({
        eq: () => Promise.resolve({
          data: [{ role: 'athlete' }],
          error: null,
        }),
      }),
    }
  })

  return { auth, from } as unknown as SupabaseClient
}

describe('requireAccountContext', () => {
  it('shares one account resolution for repeated calls on the same client', async () => {
    const client = createFakeClient()

    const [first, second] = await Promise.all([
      requireAccountContext(client),
      requireAccountContext(client),
    ])

    expect(second).toBe(first)
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledTimes(2)
    expect(first).toEqual({
      authUserId: 'auth-1',
      ownerProfileId: 'profile-1',
      accountStatus: 'active',
      roles: ['athlete'],
      mustChangePassword: false,
    })
  })
})
