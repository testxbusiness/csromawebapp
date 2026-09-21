import type { createAdminClient } from '@/lib/supabase/server'
import {
  assertMessageRecipientsInSeason,
  resolveAdminMessageSeasonScope,
} from './admin-message-season'

function query(data: unknown, error: unknown = null) {
  const chain = { data, error, select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn(), lte: jest.fn(), or: jest.fn() }
  Object.values(chain).forEach((method) => {
    if (typeof method === 'function') (method as jest.Mock).mockReturnValue(chain)
  })
  return chain
}

describe('admin message season scope', () => {
  it('defaults to the active season and includes authorized family accounts', async () => {
    const rows: Record<string, unknown> = {
      seasons: [
        { id: 'season-current', name: '2026/2027', is_active: true },
        { id: 'season-old', name: '2025/2026', is_active: false },
      ],
      activities: [{ id: 'activity-current' }],
      teams: [{ id: 'team-current', name: 'Under 14', code: 'U14-2627' }],
      season_profiles: [{ profile_id: 'athlete-current', status: 'active' }],
      profile_relationships: [{ source_profile_id: 'family-current' }],
      app_accounts: [
        { owner_profile_id: 'athlete-current', auth_user_id: 'auth-athlete', status: 'active' },
        { owner_profile_id: 'family-current', auth_user_id: 'auth-family', status: 'active' },
      ],
      profiles: [
        { id: 'athlete-current', first_name: 'Atleta', last_name: 'Corrente', email: 'athlete@test.it' },
        { id: 'family-current', first_name: 'Genitore', last_name: 'Corrente', email: 'family@test.it' },
      ],
      account_roles: [
        { auth_user_id: 'auth-athlete', role: 'athlete' },
        { auth_user_id: 'auth-family', role: 'family_member' },
      ],
    }
    const admin = { from: jest.fn((table: string) => query(rows[table] ?? [])) } as unknown as ReturnType<typeof createAdminClient>

    const scope = await resolveAdminMessageSeasonScope(admin)

    expect(scope.selectedSeasonId).toBe('season-current')
    expect([...scope.teamIds]).toEqual(['team-current'])
    expect([...scope.profileIds]).toEqual(expect.arrayContaining(['athlete-current', 'family-current']))
    expect(scope.users.find((user) => user.id === 'family-current')?.role).toBe('family_member')
  })

  it('rejects recipients outside the selected season', () => {
    const scope = {
      seasons: [],
      selectedSeasonId: 'season-current',
      teams: [],
      users: [],
      recipientProfiles: [],
      teamIds: new Set(['team-current']),
      profileIds: new Set(['profile-current']),
      selectableProfileIds: new Set(['profile-current']),
    }

    expect(() => assertMessageRecipientsInSeason(scope, ['team-old'], [])).toThrow('stagione selezionata')
    expect(() => assertMessageRecipientsInSeason(scope, [], ['profile-old'])).toThrow('destinatari attivi')
  })
})
