import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { selectableEarlyAbsenceEvents } from '@/server/events/early-absence'
import { DELETE, GET, POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/events/attendance-availability', () => ({ resolveAttendanceAvailability: jest.fn() }))
jest.mock('@/server/events/early-absence', () => ({ selectableEarlyAbsenceEvents: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const availabilityMock = resolveAttendanceAvailability as jest.MockedFunction<typeof resolveAttendanceAvailability>
const pageMock = selectableEarlyAbsenceEvents as jest.MockedFunction<typeof selectableEarlyAbsenceEvents>

const subject = {
  account: { authUserId: 'actor-1' }, profileId: 'subject-1', dataClient: {}, delegated: true,
  permissions: { confirm_attendance: true, view_schedule: true },
} as never

function request(method: string, body: unknown, url = 'http://localhost/api/athlete/events/early-absence?subjectProfileId=subject-1') {
  return { method, url, json: async () => body } as unknown as NextRequest
}

describe('/api/athlete/events/early-absence', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    subjectMock.mockResolvedValue(subject)
    availabilityMock.mockResolvedValue({ availabilityByEventId: new Map(), events: [] } as never)
    pageMock.mockReturnValue({ events: [], has_more: false, next_offset: null, total: 0 })
  })

  it('deduplicates IDs and uses one atomic RPC for a bulk report', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null })
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
    availabilityMock.mockResolvedValue({
      events: [], availabilityByEventId: new Map([
        ['11111111-1111-4111-8111-111111111111', { actions: { report_early_absence: true } }],
      ]),
    } as never)

    const response = await POST(request('POST', {
      event_ids: [
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
      ], note: '  visita  ',
    }))

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('record_athlete_early_absence')
    expect(rpc.mock.calls[0][1]).toEqual(expect.objectContaining({
      p_event_ids: ['11111111-1111-4111-8111-111111111111'], p_note: 'visita',
      p_profile_id: 'subject-1', p_actor_auth_user_id: 'actor-1', p_response_source: 'parent',
    }))
  })

  it('rejects a mixed authorized/unauthorized selection before any write', async () => {
    const rpc = jest.fn()
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
    availabilityMock.mockResolvedValue({
      events: [], availabilityByEventId: new Map([
        ['11111111-1111-4111-8111-111111111111', { actions: { report_early_absence: true } }],
      ]),
    } as never)

    const response = await POST(request('POST', {
      event_ids: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    }))

    expect(response.status).toBe(409)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns explicit pagination metadata for period selection', async () => {
    pageMock.mockReturnValue({ events: [{ id: 'event-1' }], has_more: true, next_offset: 2, total: 3 } as never)
    const response = await GET({
      url: 'http://localhost/api/athlete/events/early-absence?subjectProfileId=subject-1&from=2026-09-01&to=2026-09-30&offset=1&limit=1',
    } as unknown as NextRequest)

    expect(response.status).toBe(200)
    expect((response as unknown as { body: { has_more: boolean; next_offset: number } }).body).toEqual(expect.objectContaining({ has_more: true, next_offset: 2, limit: 1, offset: 1 }))
    expect(pageMock).toHaveBeenCalledWith(expect.anything(), '2026-09-01', '2026-09-30', 1, 1)
  })

  it('uses the same atomic endpoint for revocation', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null })
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
    availabilityMock.mockResolvedValue({
      events: [], availabilityByEventId: new Map([
        ['11111111-1111-4111-8111-111111111111', { actions: { revoke_early_absence: true } }],
      ]),
    } as never)
    const response = await DELETE(request('DELETE', { event_ids: ['11111111-1111-4111-8111-111111111111'] }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('revoke_athlete_early_absence', expect.objectContaining({
      p_event_ids: ['11111111-1111-4111-8111-111111111111'], p_profile_id: 'subject-1',
    }))
  })
})
