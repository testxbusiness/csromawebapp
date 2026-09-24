import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('next/server', () => ({
  NextRequest: class TestRequest {
    constructor(public url: string, private readonly init: { body?: string } = {}) {}
    async json() { return JSON.parse(this.init.body ?? 'null') }
  },
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

import { NextRequest } from 'next/server'

const targetPayload = {
  name: 'Stagione 2026/2027',
  start_date: '2026-09-01',
  end_date: '2027-06-30',
  is_active: false,
}

const futureTargetPayload = {
  name: 'Stagione 2027/2028',
  start_date: '2027-09-01',
  end_date: '2028-06-30',
  is_active: false,
}

const targetSeason = {
  id: '11111111-1111-4111-8111-111111111111',
  ...targetPayload,
  created_at: '2026-09-15T10:00:00.000Z',
  updated_at: '2026-09-15T10:00:00.000Z',
}

const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/seasons', { body: JSON.stringify(body) })
}

describe('POST /api/admin/seasons', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({ ownerProfileId: 'admin-1' } as Awaited<ReturnType<typeof requireGlobalRole>>)
  })

  it('requires the admin before creating the privileged client', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    const response = await POST(request(targetPayload))

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...targetPayload, is_active: true }, 'active target'],
    [{ ...targetPayload, start_date: '2027-06-30', end_date: '2026-09-01' }, 'inverted dates'],
  ])('rejects %s before database writes', async (payload) => {
    const response = await POST(request(payload))

    expect([400, 409]).toContain(response.status)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('creates an inactive target and returns it', async () => {
    const select = jest.fn().mockResolvedValue({ data: [], error: null })
    const single = jest.fn().mockResolvedValue({ data: targetSeason, error: null })
    const insertSelect = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select: insertSelect })
    createAdminClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select, insert }) } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request(targetPayload))

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ season: targetSeason, created: true })
    expect(insert).toHaveBeenCalledWith(targetPayload)
  })

  it('creates a future inactive draft without a hard-coded name or period', async () => {
    const futureTarget = { ...targetSeason, ...futureTargetPayload }
    const select = jest.fn().mockResolvedValue({ data: [], error: null })
    const single = jest.fn().mockResolvedValue({ data: futureTarget, error: null })
    const insertSelect = jest.fn().mockReturnValue({ single })
    const insert = jest.fn().mockReturnValue({ select: insertSelect })
    createAdminClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select, insert }) } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request(futureTargetPayload))

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ season: futureTarget, created: true })
    expect(insert).toHaveBeenCalledWith(futureTargetPayload)
  })

  it('returns the existing inactive target without inserting on retry', async () => {
    const select = jest.fn().mockResolvedValue({ data: [targetSeason], error: null })
    const insert = jest.fn()
    createAdminClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select, insert }) } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request(targetPayload))

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ season: targetSeason, created: false })
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns a conflict for an active or overlapping target', async () => {
    const existing = { ...targetSeason, is_active: true }
    const select = jest.fn().mockResolvedValue({ data: [existing], error: null })
    createAdminClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createAdminClient>)

    const activeResponse = await POST(request(targetPayload))
    expect(activeResponse.status).toBe(409)

    select.mockResolvedValue({
      data: [{ ...targetSeason, id: '22222222-2222-4222-8222-222222222222', name: 'Stagione 2026/2027 parziale', start_date: '2026-08-01', end_date: '2026-10-01' }],
      error: null,
    })
    const overlappingResponse = await POST(request(targetPayload))
    expect(overlappingResponse.status).toBe(409)
  })

  it('surfaces database failures as visible server errors', async () => {
    const select = jest.fn().mockResolvedValue({ data: null, error: new Error('database unavailable') })
    createAdminClientMock.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request(targetPayload))

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Impossibile verificare le stagioni esistenti' })
  })
})
