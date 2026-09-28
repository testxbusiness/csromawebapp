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

function query(data: unknown) {
  const builder = { select: jest.fn(), in: jest.fn(), not: jest.fn(), then: jest.fn() }
  builder.select.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.not.mockReturnValue(builder)
  builder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => unknown) => Promise.resolve(resolve({ data, error: null })))
  return builder
}

describe('GET /api/admin/incassi/kpi', () => {
  beforeEach(() => {
    roleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
    activeSeasonMock.mockResolvedValue({ id: 'season-current', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true })
    activeTeamIdsMock.mockResolvedValue(['team-current'])
  })

  it('calculates the default KPI only from fees assigned to active-season teams', async () => {
    const fees = query([{ id: 'fee-current' }])
    const installments = query([{ amount: 120, due_date: '2099-01-01', status: 'not_due', paid_at: null }])
    const from = jest.fn((table: string) => table === 'membership_fees' ? fees : installments)
    createClientMock.mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/admin/incassi/kpi' } as Request)

    expect(activeSeasonMock).toHaveBeenCalled()
    expect(activeTeamIdsMock).toHaveBeenCalledWith(expect.anything(), 'season-current')
    expect(fees.in).toHaveBeenCalledWith('team_id', ['team-current'])
    expect(installments.in).toHaveBeenCalledWith('membership_fee_id', ['fee-current'])
    expect((response as unknown as { body: { data: unknown } }).body.data).toEqual(expect.objectContaining({ not_due: 1, total_amount: 120, total_paid: 0 }))
  })
})
