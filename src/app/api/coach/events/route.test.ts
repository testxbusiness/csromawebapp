import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({
  requireAccountContext: jest.fn(),
  AccountContextError: class AccountContextError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } },
}))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>

describe('POST /api/coach/events', () => {
  beforeEach(() => { createClientMock.mockReset(); accountMock.mockReset() })

  it('rejects accounts without the coach role before mutation', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'athlete-a', roles: ['athlete'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)

    const response = await POST({ json: async () => ({ action: 'create', event: { title: 'Test', start_time: '2026-09-01T10:00:00Z', end_time: '2026-09-01T11:00:00Z', selected_teams: ['team-a'] } }) } as unknown as NextRequest)

    expect(response.status).toBe(403)
  })
})
