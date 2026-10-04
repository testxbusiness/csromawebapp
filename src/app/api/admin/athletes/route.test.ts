import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { PATCH } from './route'

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }),
  },
}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-global-role', () => ({ requireGlobalRole: jest.fn() }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const requireGlobalRoleMock = requireGlobalRole as jest.MockedFunction<typeof requireGlobalRole>

const seasonId = '11111111-1111-4111-8111-111111111111'
const athleteId = '22222222-2222-4222-8222-222222222222'

function request(body: unknown) {
  return { json: async () => body } as NextRequest
}

function maybeSingle(data: unknown) {
  return jest.fn().mockResolvedValue({ data, error: null })
}

function chainToMaybeSingle(data: unknown) {
  const result = maybeSingle(data)
  const secondEq = jest.fn().mockReturnValue({ maybeSingle: result })
  const firstEq = jest.fn().mockReturnValue({ eq: secondEq, maybeSingle: result })
  return { select: jest.fn().mockReturnValue({ eq: firstEq }) }
}

describe('PATCH /api/admin/athletes enrollment application', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
  })

  it('rejects a single toggle when the athlete is not enrolled in the selected season', async () => {
    const adminClient = {
      from: jest.fn((table: string) => {
        if (table === 'profiles') return chainToMaybeSingle({ id: athleteId })
        if (table === 'seasons') return chainToMaybeSingle({ id: seasonId })
        if (table === 'athlete_profiles') return chainToMaybeSingle({ profile_id: athleteId })
        if (table === 'season_profiles') return chainToMaybeSingle(null)
        throw new Error(`Unexpected table ${table}`)
      }),
    }
    createAdminClientMock.mockReturnValue(adminClient as unknown as ReturnType<typeof createAdminClient>)

    const response = await PATCH(request({
      id: athleteId,
      season_id: seasonId,
      enrollment_application_delivered: true,
    }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'L’atleta non è iscritto alla stagione selezionata' })
  })

  it('requires an admin before a single toggle can reach the privileged client', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await PATCH(request({
      id: athleteId,
      season_id: seasonId,
      enrollment_application_delivered: true,
    }))

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })
})
