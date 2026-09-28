import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { reconcileTrainingSchedules } from '@/server/trainings/training-schedule-reconciliation'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))
jest.mock('@/server/trainings/training-schedule-reconciliation', () => ({ reconcileTrainingSchedules: jest.fn() }))
jest.mock('next/server', () => ({
  NextRequest: class TestRequest {
    constructor(public url: string, private readonly init: { body?: string } = {}) {}
    async json() { return JSON.parse(this.init.body ?? 'null') }
  },
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))

import { NextRequest } from 'next/server'

const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>
const reconcileMock = reconcileTrainingSchedules as jest.MockedFunction<typeof reconcileTrainingSchedules>

describe('POST /api/admin/training-schedules', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    createAdminClientMock.mockReturnValue({} as ReturnType<typeof createAdminClient>)
  })

  it('requires the resolved admin account before creating the privileged client', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Ruolo globale non autorizzato', 403))

    const response = await POST(new NextRequest('http://localhost/api/admin/training-schedules', {
      method: 'POST', body: JSON.stringify({ team_id: '11111111-1111-4111-8111-111111111111', schedules: [] }),
    }))

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('rejects invalid schedule payloads before reconciliation', async () => {
    requireGlobalRoleMock.mockResolvedValue({ ownerProfileId: 'admin-1' } as Awaited<ReturnType<typeof requireGlobalRole>>)

    const response = await POST(new NextRequest('http://localhost/api/admin/training-schedules', {
      method: 'POST', body: JSON.stringify({ team_id: 'not-a-uuid', schedules: [] }),
    }))

    expect(response.status).toBe(400)
    expect(reconcileMock).not.toHaveBeenCalled()
  })

  it('returns the reconciliation report and its failure status', async () => {
    requireGlobalRoleMock.mockResolvedValue({ ownerProfileId: 'admin-1' } as Awaited<ReturnType<typeof requireGlobalRole>>)
    reconcileMock.mockResolvedValue({
      success: false, schedulesCreated: 0, schedulesUpdated: 1, schedulesDeactivated: 0,
      eventsCreated: 0, eventsUpdated: 0, eventsPreserved: 0, errors: 1, warnings: [],
    })

    const response = await POST(new NextRequest('http://localhost/api/admin/training-schedules', {
      method: 'POST', body: JSON.stringify({ team_id: '11111111-1111-4111-8111-111111111111', schedules: [] }),
    }))

    expect(response.status).toBe(500)
    expect(reconcileMock).toHaveBeenCalledWith(expect.anything(), '11111111-1111-4111-8111-111111111111', [], 'admin-1')
  })
})
