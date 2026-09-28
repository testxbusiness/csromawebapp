import { createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/seasons/active-season', () => ({ resolveActiveSeason: jest.fn(), resolveActiveSeasonTeamIds: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const roleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>
const activeSeasonMock = resolveActiveSeason as jest.MockedFunction<typeof resolveActiveSeason>
const activeTeamIdsMock = resolveActiveSeasonTeamIds as jest.MockedFunction<typeof resolveActiveSeasonTeamIds>

function installmentsQuery() {
  const builder = {
    select: jest.fn(), not: jest.fn(), in: jest.fn(), range: jest.fn(), order: jest.fn(), then: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.not.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.range.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) => Promise.resolve(resolve({
    data: [{ id: 'installment-any-season', profiles: { id: 'profile-1' }, membership_fees: { teams: { id: 'team-history' } } }],
    error: null,
    count: 1,
  })))
  return builder
}

describe('GET /api/admin/incassi/installments', () => {
  beforeEach(() => {
    roleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
    activeSeasonMock.mockResolvedValue({ id: 'season-current', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true })
    activeTeamIdsMock.mockResolvedValue(['team-current'])
  })

  it('keeps the explicit all-seasons view unscoped by team', async () => {
    const installments = installmentsQuery()
    const from = jest.fn().mockReturnValue(installments)
    createClientMock.mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/admin/incassi/installments?season_id=all' } as Request)

    expect(response.status).toBe(200)
    expect(activeSeasonMock).not.toHaveBeenCalled()
    expect(activeTeamIdsMock).not.toHaveBeenCalled()
    expect(installments.in).not.toHaveBeenCalledWith('membership_fee_id', ['00000000-0000-0000-0000-000000000000'])
    expect((response as unknown as { body: { total: number } }).body.total).toBe(1)
  })
})
