import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { AccountContextError } from '@/server/auth/require-account-context'
import { requireSubjectAthleteContext } from '@/server/auth/require-subject-profile'
import { resolveAttendanceAvailability } from '@/server/events/attendance-availability'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn(), createClient: jest.fn() }))
jest.mock('@/server/auth/require-subject-profile', () => ({ requireSubjectAthleteContext: jest.fn() }))
jest.mock('@/server/events/attendance-availability', () => ({ resolveAttendanceAvailability: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const subjectMock = requireSubjectAthleteContext as jest.MockedFunction<typeof requireSubjectAthleteContext>
const availabilityMock = resolveAttendanceAvailability as jest.MockedFunction<typeof resolveAttendanceAvailability>

describe('POST /api/athlete/events/attendance', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    createAdminClientMock.mockReturnValue({ rpc: jest.fn() } as unknown as ReturnType<typeof createAdminClient>)
    subjectMock.mockReset()
    availabilityMock.mockReset()
  })

  it('requires confirm_attendance for the requested subject before mutating attendance', async () => {
    subjectMock.mockRejectedValueOnce(new AccountContextError('Permesso non concesso', 403))

    const response = await POST({
      url: 'http://localhost/api/athlete/events/attendance?subjectProfileId=subject-1',
      json: async () => ({ event_id: 'event-1', status: 'going' }),
    } as unknown as NextRequest)

    expect(response.status).toBe(403)
    expect(subjectMock).toHaveBeenCalledWith(expect.anything(), 'subject-1', 'confirm_attendance')
  })

  it('uses R4 and the protected mutation for an automatic event', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null })
    createAdminClientMock.mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
    subjectMock.mockResolvedValue({
      account: { authUserId: 'actor-1' }, profileId: 'subject-1', dataClient: {}, delegated: true,
      permissions: { confirm_attendance: true, view_schedule: true },
    } as never)
    availabilityMock.mockResolvedValue({
      events: [{ id: '11111111-1111-4111-8111-111111111111', generated_from_schedule_id: 'schedule-1', requires_confirmation: true }],
      availabilityByEventId: new Map([['11111111-1111-4111-8111-111111111111', { actions: { respond: true } }]]),
    } as never)
    const response = await POST({
      url: 'http://localhost/api/athlete/events/attendance?subjectProfileId=subject-1',
      json: async () => ({ event_id: '11111111-1111-4111-8111-111111111111', status: 'going', note: '  ok  ' }),
    } as unknown as NextRequest)

    expect(response.status).toBe(200)
    expect(availabilityMock).toHaveBeenCalledWith({}, 'subject-1', expect.anything(), ['11111111-1111-4111-8111-111111111111'], expect.any(Date), [])
    expect(createAdminClientMock).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('record_athlete_attendance', {
      p_event_id: '11111111-1111-4111-8111-111111111111', p_profile_id: 'subject-1', p_status: 'going', p_note: 'ok',
      p_actor_auth_user_id: 'actor-1', p_response_source: 'parent',
    })
  })

  it('rejects a later or already-started automatic event before writing', async () => {
    subjectMock.mockResolvedValue({
      account: { authUserId: 'actor-1' }, profileId: 'subject-1', dataClient: {}, delegated: false,
      permissions: { confirm_attendance: true, view_schedule: true },
    } as never)
    availabilityMock.mockResolvedValue({
      events: [{ id: '22222222-2222-4222-8222-222222222222', generated_from_schedule_id: 'schedule-2', requires_confirmation: true }],
      availabilityByEventId: new Map([['22222222-2222-4222-8222-222222222222', { actions: { respond: false }, closure_reason: 'not_next_event' }]]),
    } as never)

    const response = await POST({
      url: 'http://localhost/api/athlete/events/attendance',
      json: async () => ({ event_id: '22222222-2222-4222-8222-222222222222', status: 'maybe' }),
    } as unknown as NextRequest)

    expect(response.status).toBe(409)
    expect((response as unknown as { body: { error: string } }).body.error).toMatch(/prima un altro evento/)
  })
})
