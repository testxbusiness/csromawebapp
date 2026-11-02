import { DELETE } from './route'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireGlobalRole } from '@/server/auth/require-global-role'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) } }))
jest.mock('@/server/audit/account-lifecycle', () => ({ getAccountActorSnapshot: jest.fn(), recordAccountLifecycleAudit: jest.fn() }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

function awaitedQuery(result: unknown) {
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  return query
}

describe('DELETE /api/admin/membership-fees safety guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
  })

  it('blocks deletion when any installment has been issued and leaves plan/template untouched', async () => {
    const installments = awaitedQuery({ data: [{ id: 'installment-1' }], error: null })
    const from = jest.fn(() => installments)
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)

    const response = await DELETE({ url: 'http://localhost/api/admin/membership-fees?id=fee-1' } as never)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'FEE_HAS_ISSUED_INSTALLMENTS', installmentCount: 1 })
    expect(from).toHaveBeenCalledTimes(1)
    expect(installments.delete).not.toHaveBeenCalled()
  })

  it('allows deletion when the plan has no issued installments', async () => {
    const issued = awaitedQuery({ data: [], error: null })
    const templates = awaitedQuery({ error: null })
    const feeDelete = awaitedQuery({ error: null })
    const from = jest.fn().mockReturnValueOnce(issued).mockReturnValueOnce(templates).mockReturnValueOnce(feeDelete)
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)

    const response = await DELETE({ url: 'http://localhost/api/admin/membership-fees?id=fee-1' } as never)
    expect(response.status).toBe(200)
    expect(templates.delete).toHaveBeenCalled()
    expect(feeDelete.delete).toHaveBeenCalled()
  })
})
