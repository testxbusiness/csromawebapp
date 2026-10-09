import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSubjectAthleteContext } from './require-subject-profile'
import { requireAccountContext } from './require-account-context'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'
import { createAdminClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/server/auth/require-account-context', () => ({
  AccountContextError: class AccountContextError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message)
    }
  },
  requireAccountContext: jest.fn(),
}))

jest.mock('@/server/seasons/active-season', () => ({
  resolveActiveSeason: jest.fn(),
  resolveActiveSeasonTeamIds: jest.fn(),
}))

const accountContextMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>
const activeSeasonMock = resolveActiveSeason as jest.MockedFunction<typeof resolveActiveSeason>
const activeTeamIdsMock = resolveActiveSeasonTeamIds as jest.MockedFunction<typeof resolveActiveSeasonTeamIds>
const adminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>

const activeSeason = {
  id: 'season-1',
  name: '2026/2027',
  start_date: '2026-09-01',
  end_date: '2027-06-30',
  is_active: true as const,
}

function queryResult(data: unknown, error: unknown = null) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    lte: jest.fn(),
    or: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error })),
  }
  for (const method of ['select', 'eq', 'lte', 'or', 'limit']) {
    builder[method as 'select'].mockReturnValue(builder)
  }
  builder.maybeSingle.mockReturnValue(builder)
  return builder
}

function clientFor(results: Record<string, unknown>) {
  const client = {
    from: jest.fn((table: string) => results[table] ?? queryResult(null)),
  }
  return client as unknown as SupabaseClient
}

function ownAccount(overrides: Record<string, unknown> = {}) {
  return {
    authUserId: 'account-1',
    ownerProfileId: 'athlete-1',
    accountStatus: 'active' as const,
    roles: ['athlete' as const],
    mustChangePassword: false,
    ...overrides,
  }
}

describe('requireSubjectAthleteContext security invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    activeSeasonMock.mockResolvedValue(activeSeason)
    activeTeamIdsMock.mockResolvedValue(['team-1'])
  })

  it('allows the authenticated athlete subject', async () => {
    const client = clientFor({
      athlete_profiles: queryResult({ profile_id: 'athlete-1' }),
      season_profiles: queryResult({ profile_id: 'athlete-1' }),
    })
    accountContextMock.mockResolvedValue(ownAccount())

    await expect(requireSubjectAthleteContext(client, null)).resolves.toMatchObject({
      profileId: 'athlete-1',
      delegated: false,
      activeTeamIds: ['team-1'],
    })
  })

  it('allows a delegated subject only through the active relationship permissions', async () => {
    const client = clientFor({})
    const adminClient = clientFor({
      profile_relationships: queryResult({
        source_profile_id: 'account-owner',
        target_profile_id: 'athlete-2',
        relationship_type: 'parent',
        verified_at: null,
        can_view_schedule: true,
        can_confirm_attendance: false,
        can_view_payments: false,
        can_view_medical_status: false,
        can_view_documents: false,
        can_sign_documents: false,
        can_receive_messages: false,
      }),
      profiles: queryResult({ birth_date: '2015-01-01' }),
      profile_age_overrides: queryResult(null),
      athlete_profiles: queryResult({ profile_id: 'athlete-2' }),
      season_profiles: queryResult({ profile_id: 'athlete-2' }),
    })
    accountContextMock.mockResolvedValue(ownAccount({
      ownerProfileId: 'account-owner',
      roles: ['family_member'],
    }))
    adminClientMock.mockReturnValue(adminClient)

    await expect(requireSubjectAthleteContext(client, 'athlete-2', 'view_schedule')).resolves.toMatchObject({
      profileId: 'athlete-2',
      delegated: true,
      permissions: { view_schedule: true },
    })
  })

  it('rejects an unavailable delegated subject with 403', async () => {
    const client = clientFor({})
    adminClientMock.mockReturnValue(clientFor({
      profile_relationships: queryResult(null),
      profiles: queryResult({ birth_date: '2015-01-01' }),
      profile_age_overrides: queryResult(null),
    }))
    accountContextMock.mockResolvedValue(ownAccount({ roles: ['family_member'] }))

    await expect(requireSubjectAthleteContext(client, 'other-athlete')).rejects.toMatchObject({ status: 403 })
    expect(activeSeasonMock).not.toHaveBeenCalled()
  })

  it('scopes delegated relationship lookup to the authenticated account owner', async () => {
    const client = clientFor({})
    const relationshipQuery = queryResult(null)
    const adminClient = clientFor({
      profile_relationships: relationshipQuery,
      profiles: queryResult(null),
      profile_age_overrides: queryResult(null),
    })
    adminClientMock.mockReturnValue(adminClient)
    accountContextMock.mockResolvedValue(ownAccount({ ownerProfileId: 'account-owner' }))

    await expect(requireSubjectAthleteContext(client, 'other-athlete')).rejects.toMatchObject({ status: 403 })
    expect(relationshipQuery.eq).toHaveBeenCalledWith('source_profile_id', 'account-owner')
    expect(relationshipQuery.eq).toHaveBeenCalledWith('target_profile_id', 'other-athlete')
  })
})
