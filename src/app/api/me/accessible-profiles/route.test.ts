import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { resolveActiveSeason } from '@/server/seasons/active-season'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({ requireAccountContext: jest.fn() }))
jest.mock('@/server/seasons/active-season', () => ({ resolveActiveSeason: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>
const activeSeasonMock = resolveActiveSeason as jest.MockedFunction<typeof resolveActiveSeason>

function query(data: unknown) {
  const builder = {
    select: jest.fn(), eq: jest.fn(), lte: jest.fn(), or: jest.fn(), neq: jest.fn(), in: jest.fn(), then: jest.fn(),
  }
  for (const method of [builder.select, builder.eq, builder.lte, builder.or, builder.neq, builder.in]) method.mockReturnValue(builder)
  builder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => unknown) => Promise.resolve(resolve({ data, error: null })))
  return builder
}

describe('GET /api/me/accessible-profiles', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    accountMock.mockResolvedValue({ ownerProfileId: 'family-1', roles: ['family_member'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    activeSeasonMock.mockResolvedValue({ id: 'season-current', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true })
  })

  it('returns only related subjects with an active membership in the active season', async () => {
    const relationships = query([
      { id: 'relationship-included', source_profile_id: 'family-1', target_profile_id: 'athlete-included', relationship_type: 'parent', status: 'active', valid_from: '2020-01-01', valid_until: null, verified_at: null, can_view_schedule: true, can_confirm_attendance: true, can_view_payments: true, can_view_medical_status: false, can_view_documents: false, can_sign_documents: false, can_receive_messages: true, is_primary_contact: true, is_billing_contact: false, is_emergency_contact: false },
      { id: 'relationship-excluded', source_profile_id: 'family-1', target_profile_id: 'athlete-excluded', relationship_type: 'parent', status: 'active', valid_from: '2020-01-01', valid_until: null, verified_at: null, can_view_schedule: true, can_confirm_attendance: true, can_view_payments: true, can_view_medical_status: false, can_view_documents: false, can_sign_documents: false, can_receive_messages: true, is_primary_contact: true, is_billing_contact: false, is_emergency_contact: false },
    ])
    const profiles = query([
      { id: 'athlete-included', first_name: 'Incluso', last_name: 'Test', email: null, birth_date: '2012-01-01' },
      { id: 'athlete-excluded', first_name: 'Escluso', last_name: 'Test', email: null, birth_date: '2012-01-01' },
    ])
    const overrides = query([])
    const memberships = query([{ profile_id: 'athlete-included' }])
    const from = jest.fn((table: string) => ({ profile_relationships: relationships, profiles, profile_age_overrides: overrides, season_profiles: memberships })[table])
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(memberships.eq).toHaveBeenCalledWith('season_id', 'season-current')
    expect(memberships.eq).toHaveBeenCalledWith('status', 'active')
    expect((response as unknown as { body: { profiles: Array<{ profile: { id: string } }> } }).body.profiles).toEqual([
      expect.objectContaining({ profile: expect.objectContaining({ id: 'athlete-included' }) }),
    ])
  })

  it('keeps the family account usable while returning an explicit empty subject list', async () => {
    const relationships = query([])
    const profiles = query([])
    const overrides = query([])
    const from = jest.fn((table: string) => ({ profile_relationships: relationships, profiles, profile_age_overrides: overrides })[table])
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)

    await expect(GET()).resolves.toMatchObject({ status: 200, body: { profiles: [] } })
  })
})
