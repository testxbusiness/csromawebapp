import { syncProfileEmail } from './profile-email'

function query(data: unknown, error: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error })
  const eq = jest.fn().mockReturnValue({ maybeSingle })
  return { select: jest.fn().mockReturnValue({ eq }), update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }
}

describe('syncProfileEmail', () => {
  it('updates both public profile and Auth for a provisioned account', async () => {
    const profileQuery = query({ email: 'old@example.com' })
    const accountQuery = query({ auth_user_id: 'auth-1' })
    const profileUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const auth = {
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'old@example.com' } }, error: null }),
        updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }
    profileQuery.update = profileUpdate
    const adminClient = {
      from: jest.fn((table: string) => table === 'profiles' ? profileQuery : accountQuery),
      auth,
    }

    const result = await syncProfileEmail(adminClient as never, 'profile-1', 'new@example.com')

    expect(result).toEqual({ ok: true })
    expect(auth.admin.updateUserById).toHaveBeenCalledWith('auth-1', { email: 'new@example.com' })
    expect(profileUpdate).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('updates only the public profile when no Auth account exists', async () => {
    const profileUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const profileQuery = query({ email: null })
    profileQuery.update = profileUpdate
    const auth = { admin: { getUserById: jest.fn(), updateUserById: jest.fn() } }
    const adminClient = {
      from: jest.fn((table: string) => table === 'profiles' ? profileQuery : query(null)),
      auth,
    }

    const result = await syncProfileEmail(adminClient as never, 'profile-1', 'new@example.com')

    expect(result).toEqual({ ok: true })
    expect(profileUpdate).toHaveBeenCalledWith({ email: 'new@example.com' })
    expect(auth.admin.getUserById).not.toHaveBeenCalled()
  })

  it('does not update the profile when Auth rejects a duplicate email', async () => {
    const profileUpdate = jest.fn()
    const profileQuery = query({ email: 'old@example.com' })
    profileQuery.update = profileUpdate
    const accountQuery = query({ auth_user_id: 'auth-1' })
    const adminClient = {
      from: jest.fn((table: string) => table === 'profiles' ? profileQuery : accountQuery),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'old@example.com' } }, error: null }),
          updateUserById: jest.fn().mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'already registered' } }),
        },
      },
    }

    const result = await syncProfileEmail(adminClient as never, 'profile-1', 'new@example.com')

    expect(result).toEqual({ ok: false, error: 'L’email è già associata a un altro account Auth' })
    expect(profileUpdate).not.toHaveBeenCalled()
  })
})
