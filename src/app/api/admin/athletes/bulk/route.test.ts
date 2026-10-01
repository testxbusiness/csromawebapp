import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireGlobalRole } from '@/server/auth/require-global-role'
import { POST } from './route'

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

function seasonQuery(season = { id: seasonId, name: 'Stagione 2026/2027' }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: season, error: null })
  const eq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq })
  return { select, eq, maybeSingle }
}

describe('POST /api/admin/athletes/bulk enrollment application', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    requireGlobalRoleMock.mockResolvedValue({} as Awaited<ReturnType<typeof requireGlobalRole>>)
  })

  it('requires an admin before parsing or mutating the request', async () => {
    requireGlobalRoleMock.mockRejectedValue(new AccountContextError('Permesso non concesso', 403))

    const response = await POST(request({}) )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Permesso non concesso' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('rejects an empty or duplicate selection before calling the atomic mutation', async () => {
    const rpc = jest.fn()
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request({
      operation: 'set_enrollment_application_delivered',
      athleteIds: [athleteId, athleteId],
      parameters: { seasonId, delivered: true },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Parametri non validi' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('uses the atomic RPC for the whole selected season and returns its affected count', async () => {
    const query = seasonQuery()
    const rpc = jest.fn().mockResolvedValue({ data: 1, error: null })
    const from = jest.fn().mockReturnValue({ select: query.select })
    createAdminClientMock.mockReturnValue({ from, rpc } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request({
      operation: 'set_enrollment_application_delivered',
      athleteIds: [athleteId],
      parameters: { seasonId, delivered: false },
    }))

    expect(rpc).toHaveBeenCalledWith('set_athlete_enrollment_application_delivered_atomically', {
      p_season_id: seasonId,
      p_athlete_ids: [athleteId],
      p_delivered: false,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ affected: 1, delivered: false, seasonId })
  })

  it('does not attempt a fallback update when atomic validation rejects one athlete outside the season', async () => {
    const query = seasonQuery()
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'outside season' } })
    const from = jest.fn().mockReturnValue({ select: query.select })
    createAdminClientMock.mockReturnValue({ from, rpc } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST(request({
      operation: 'set_enrollment_application_delivered',
      athleteIds: [athleteId],
      parameters: { seasonId, delivered: true },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'La selezione contiene atleti non iscritti alla stagione selezionata' })
    expect(from).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
