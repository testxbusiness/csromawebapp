import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: jest.fn(),
  createClient: jest.fn(),
}))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))

const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

function emptyEventsQuery() {
  const query = {
    select: jest.fn(),
    lte: jest.fn(),
    gte: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    then: (resolve: (value: { data: never[]; error: null; count: number }) => unknown) =>
      Promise.resolve(resolve({ data: [], error: null, count: 0 })),
  }
  query.select.mockReturnValue(query)
  query.lte.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  return query
}

describe('GET /api/admin/events visible range contract', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
    createAdminClientMock.mockReset()
  })

  it.each([
    'from=not-a-date&to=2026-09-30T00:00:00.000Z',
    'from=2026-10-01T00:00:00.000Z&to=2026-09-30T00:00:00.000Z',
    'from=2026-01-01T00:00:00.000Z&to=2026-04-01T00:00:00.000Z&visible=1',
  ])('rejects an invalid visible interval: %s', async (query) => {
    const from = jest.fn()
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
    const response = await GET({ url: `http://localhost/api/admin/events?${query}` } as unknown as NextRequest)

    expect(response.status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })

  it('clamps visible loading to 500 events and queries by overlap', async () => {
    const query = emptyEventsQuery()
    createAdminClientMock.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminClient>)

    const response = await GET({
      url: 'http://localhost/api/admin/events?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z&visible=1&limit=9999',
    } as unknown as NextRequest)

    expect(response.status).toBe(200)
    expect(query.lte).toHaveBeenCalledWith('start_date', '2026-09-30T23:59:59.999Z')
    expect(query.gte).toHaveBeenCalledWith('end_date', '2026-09-01T00:00:00.000Z')
    expect(query.range).toHaveBeenCalledWith(0, 499)
    expect((response as unknown as { body: { limit: number } }).body.limit).toBe(500)
  })
})
