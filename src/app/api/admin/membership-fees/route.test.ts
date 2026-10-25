import { PATCH } from './route'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { getAccountActorSnapshot, recordAccountLifecycleAudit } from '@/server/audit/account-lifecycle'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}))
jest.mock('@/server/audit/account-lifecycle', () => ({
  getAccountActorSnapshot: jest.fn(),
  recordAccountLifecycleAudit: jest.fn(),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>
const getAccountActorSnapshotMock = getAccountActorSnapshot as jest.MockedFunction<typeof getAccountActorSnapshot>
const recordAccountLifecycleAuditMock = recordAccountLifecycleAudit as jest.MockedFunction<typeof recordAccountLifecycleAudit>

const request = (body: unknown) => ({ json: async () => body }) as Parameters<typeof PATCH>[0]

describe('PATCH /api/admin/membership-fees payment reversal', () => {
  const account = { authUserId: 'auth-admin', ownerProfileId: 'profile-admin' }
  const installment = {
    id: '00000000-0000-4000-8000-000000000001',
    profile_id: 'athlete-1',
    membership_fee_id: 'fee-1',
    installment_number: 2,
    due_date: '2020-10-01',
    amount: 100,
    status: 'paid',
    paid_at: '2026-10-20T10:00:00.000Z',
    paid_by_auth_user_id: 'auth-admin',
    payment_source: 'admin',
  }

  let selectQuery: {
    select: jest.Mock
    eq: jest.Mock
    maybeSingle: jest.Mock
  }
  let updateQuery: {
    update: jest.Mock
    eq: jest.Mock
    select: jest.Mock
    maybeSingle: jest.Mock
  }
  let adminClientMock: { from: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue(account as Awaited<ReturnType<typeof requireGlobalRole>>)
    getAccountActorSnapshotMock.mockResolvedValue({
      performedByEmail: 'admin@example.test',
      performedByFirstName: 'Admin',
      performedByLastName: 'Test',
    })
    recordAccountLifecycleAuditMock.mockResolvedValue(undefined)

    selectQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: installment, error: null }),
    }
    updateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: installment.id }, error: null }),
    }
    let fromCalls = 0
    adminClientMock = { from: jest.fn(() => (fromCalls++ === 0 ? selectQuery : updateQuery)) }
    createAdminClientMock.mockReturnValue(adminClientMock as unknown as ReturnType<typeof createAdminClient>)
  })

  it('resets a paid installment, clears payment metadata, and audits the correction reason', async () => {
    const response = await PATCH(request({
      action: 'reverse_installment_payment',
      installment_id: installment.id,
      reason: 'Pagamento segnato per errore',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true, status: 'overdue', auditRecorded: true })
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: 'overdue',
      paid_at: null,
      paid_by_auth_user_id: null,
      payment_source: null,
    })
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'id', installment.id)
    expect(updateQuery.eq).toHaveBeenNthCalledWith(2, 'status', 'paid')
    expect(recordAccountLifecycleAuditMock).toHaveBeenCalledWith(adminClientMock, expect.objectContaining({
      eventType: 'repair_required',
      subjectProfileId: 'athlete-1',
      performedByAuthUserId: account.authUserId,
      performedByProfileId: account.ownerProfileId,
      details: expect.objectContaining({
        action: 'fee_installment_payment_reversed',
        previous_paid_at: installment.paid_at,
        new_status: 'overdue',
        reason: 'Pagamento segnato per errore',
      }),
    }))
  })

  it('does not modify a rate that is not currently paid', async () => {
    selectQuery.maybeSingle.mockResolvedValue({ data: { ...installment, status: 'overdue' }, error: null })

    const response = await PATCH(request({
      action: 'reverse_installment_payment',
      installment_id: installment.id,
      reason: 'Pagamento segnato per errore',
    }))

    expect(response.status).toBe(409)
    expect(updateQuery.update).not.toHaveBeenCalled()
    expect(recordAccountLifecycleAuditMock).not.toHaveBeenCalled()
  })

  it('validates the correction reason before changing data', async () => {
    const response = await PATCH(request({
      action: 'reverse_installment_payment',
      installment_id: installment.id,
      reason: 'err',
    }))

    expect(response.status).toBe(400)
    expect(updateQuery.update).not.toHaveBeenCalled()
  })

  it('does not allow the regular status action to bypass the audited reversal', async () => {
    const response = await PATCH(request({
      action: 'update_installment_status',
      installment_id: installment.id,
      status: 'overdue',
    }))

    expect(response.status).toBe(400)
    expect(updateQuery.update).not.toHaveBeenCalled()
  })

  it('reports when the installment changed but audit logging failed', async () => {
    recordAccountLifecycleAuditMock.mockRejectedValue(new Error('audit unavailable'))

    const response = await PATCH(request({
      action: 'reverse_installment_payment',
      installment_id: installment.id,
      reason: 'Pagamento segnato per errore',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true, status: 'overdue', auditRecorded: false })
    expect(updateQuery.update).toHaveBeenCalled()
  })

  it('denies non-admin requests before creating a privileged client', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    const response = await PATCH(request({
      action: 'reverse_installment_payment',
      installment_id: installment.id,
      reason: 'Pagamento segnato per errore',
    }))

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })
})
