import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/profile/athlete-profile', () => ({ buildAthleteProfileContract: jest.fn(() => ({ subject: { id: 'profile-2' }, memberships: [] })) }))
jest.mock('@/server/http/no-store', () => ({ noStoreJson: (body: unknown, status = 200) => ({ body, status, headers: { get: (name: string) => name === 'Cache-Control' ? 'private, no-store' : null } }) }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>

function query(data: unknown, error: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: () => Promise.resolve({ data, error }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve, reject),
  }
  return builder
}

describe('GET /api/athlete/profile', () => {
  beforeEach(() => {
    const client = {
      from: (table: string) => table === 'profiles'
        ? query({ id: 'profile-2', first_name: 'Luca', last_name: 'Rossi', email: 'luca@example.test', phone: null, birth_date: null })
        : table === 'athlete_profiles'
          ? query({ profile_id: 'profile-2', membership_number: 'T-2', medical_certificate_expiry: '2026-12-31' })
          : table === 'team_members'
            ? query([])
            : query([]),
    }
    createClientMock.mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockResolvedValue({
      account: { authUserId: 'auth-1', ownerProfileId: 'owner-1', accountStatus: 'active', roles: ['family_member'], mustChangePassword: false },
      profileId: 'profile-2', dataClient: client as never, delegated: true,
      permissions: { view_schedule: true, confirm_attendance: false, view_payments: false, view_medical_status: true, view_documents: false, sign_documents: false, receive_messages: false },
    })
  })

  it('resolves the requested subject server-side and disables caching', async () => {
    const response = await GET({ url: 'http://localhost/api/athlete/profile?subjectProfileId=profile-2' } as NextRequest)
    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'profile-2')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('returns the authorization status when the requested subject is not accessible', async () => {
    subjectMock.mockRejectedValueOnce(new AccountContextError('Profilo non accessibile', 403))
    const response = await GET({ url: 'http://localhost/api/athlete/profile?subjectProfileId=profile-forbidden' } as NextRequest)
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Profilo non accessibile' })
    expect(createClientMock).toHaveBeenCalled()
  })
})
