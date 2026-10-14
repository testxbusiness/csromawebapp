import type { NextRequest } from 'next/server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { DELETE } from './route'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/audit/account-lifecycle', () => ({
  getAccountActorSnapshot: jest.fn().mockResolvedValue({}),
  recordAccountLifecycleAudit: jest.fn().mockResolvedValue(undefined),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

const profileId = '22222222-2222-4222-8222-222222222222'
const feeId = '33333333-3333-4333-8333-333333333333'

type QueryResult = { data: unknown; error: unknown }

function query(result: QueryResult) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
    delete: jest.fn(),
    then: jest.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.maybeSingle.mockResolvedValue(result)
  builder.then.mockImplementation((resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)))
  return builder
}

function request() {
  return {} as NextRequest
}

function setup(installments: unknown[], options?: { deleteError?: unknown; profile?: unknown; fee?: unknown }) {
  const profileQuery = query({ data: options && 'profile' in options ? options.profile : { id: profileId }, error: null })
  const feeQuery = query({ data: options && 'fee' in options ? options.fee : { id: feeId, name: 'Quota 2', team_id: 'team-1' }, error: null })
  const installmentsQuery = query({ data: installments, error: null })
  const deleteQuery = query({ data: null, error: options?.deleteError ?? null })
  const from = jest.fn((table: string) => {
    if (table === 'profiles') return profileQuery
    if (table === 'membership_fees') return feeQuery
    if (table === 'fee_installments') return installmentsQuery
    throw new Error(`Unexpected table ${table}`)
  })
  installmentsQuery.delete.mockReturnValue(deleteQuery)
  createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
  return { from, installmentsQuery, deleteQuery }
}

describe('DELETE /api/admin/athletes/:profileId/membership-fees/:membershipFeeId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({
      authUserId: '44444444-4444-4444-8444-444444444444',
      ownerProfileId: 'admin-profile',
    } as Awaited<ReturnType<typeof requireGlobalRole>>)
  })

  it('requires admin authorization before reading or deleting', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Permesso non concesso' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('deletes only the selected athlete/fee installments and is idempotent', async () => {
    const { installmentsQuery, deleteQuery } = setup([
      { id: 'a1', status: 'overdue', paid_at: null, paid_by_auth_user_id: null, payment_source: null },
      { id: 'a2', status: 'not_due', paid_at: null, paid_by_auth_user_id: null, payment_source: null },
    ])

    const response = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ result: 'removed', deleted_installments: 2, profile_id: profileId, membership_fee_id: feeId })
    expect(installmentsQuery.eq).toHaveBeenNthCalledWith(1, 'profile_id', profileId)
    expect(installmentsQuery.eq).toHaveBeenNthCalledWith(2, 'membership_fee_id', feeId)
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'profile_id', profileId)
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(2, 'membership_fee_id', feeId)

    setup([])
    const retry = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ result: 'already_removed', deleted_installments: 0 })
  })

  it.each([
    ['status paid', { status: 'paid', paid_at: null, paid_by_auth_user_id: null, payment_source: null }],
    ['paid_at set with inconsistent status', { status: 'overdue', paid_at: '2026-10-14T10:00:00Z', paid_by_auth_user_id: null, payment_source: null }],
    ['partially paid', { status: 'partially_paid', paid_at: null, paid_by_auth_user_id: null, payment_source: null }],
    ['payment actor set', { status: 'overdue', paid_at: null, paid_by_auth_user_id: 'auth-admin', payment_source: null }],
    ['payment source set', { status: 'overdue', paid_at: null, paid_by_auth_user_id: null, payment_source: 'admin' }],
  ])('blocks removal when %s', async (_caseName, installment) => {
    const { installmentsQuery } = setup([installment])

    const response = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PAID_INSTALLMENTS_BLOCK_REMOVAL' })
    expect(installmentsQuery.delete).not.toHaveBeenCalled()
  })

  it('does not delete when the athlete or fee is missing', async () => {
    setup([], { profile: null })
    const response = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })
    expect(response.status).toBe(404)

    setup([], { fee: null })
    const feeResponse = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })
    expect(feeResponse.status).toBe(404)
  })

  it('returns a server error and leaves rows untouched when deletion fails', async () => {
    const { installmentsQuery } = setup([
      { id: 'a1', status: 'not_due', paid_at: null, paid_by_auth_user_id: null, payment_source: null },
    ], { deleteError: { message: 'delete failed' } })

    const response = await DELETE(request(), { params: Promise.resolve({ profileId, membershipFeeId: feeId }) })

    expect(response.status).toBe(500)
    expect(installmentsQuery.delete).toHaveBeenCalled()
  })
})
