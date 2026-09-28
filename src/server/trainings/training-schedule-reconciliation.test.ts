import type { SupabaseClient } from '@supabase/supabase-js'
import { reconcileTrainingSchedules } from './training-schedule-reconciliation'
import type { TrainingSchedule } from '@/lib/utils/trainingScheduleEvents'

type State = Record<string, Array<Record<string, unknown>>>

function fakeAdmin(initial: State) {
  const state: State = Object.fromEntries(Object.entries(initial).map(([key, rows]) => [key, rows.map((row) => ({ ...row }))]))
  let eventSequence = 1
  let scheduleSequence = 1

  const from = (table: string) => {
    let filters: Array<(row: Record<string, unknown>) => boolean> = []
    let operation: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    let values: Record<string, unknown> | Record<string, unknown>[] | undefined
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return query },
      in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return query },
      is: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return query },
      maybeSingle: async () => { const rows = (state[table] ?? []).filter((row) => filters.every((filter) => filter(row))); return { data: rows[0] ?? null, error: null } },
      single: async () => {
        if (operation === 'insert') {
          const rows = state[table] ?? (state[table] = [])
          const input = values as Record<string, unknown>
          const inserted = { ...input, id: input.id ?? (table === 'events' ? `event-${eventSequence++}` : `schedule-${scheduleSequence++}`) }
          rows.push(inserted)
          return { data: inserted, error: null }
        }
        const rows = (state[table] ?? []).filter((row) => filters.every((filter) => filter(row)))
        return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } }
      },
      insert: (input: Record<string, unknown> | Record<string, unknown>[]) => { operation = 'insert'; values = input; return query },
      update: (input: Record<string, unknown>) => { operation = 'update'; values = input; return query },
      upsert: (input: Record<string, unknown>) => { operation = 'upsert'; values = input; return query },
      then: (resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) => {
        const rows = state[table] ?? (state[table] = [])
        const matching = rows.filter((row) => filters.every((filter) => filter(row)))
        if (operation === 'insert') {
          const inputs = Array.isArray(values) ? values : [values]
          const inserted = inputs.map((input) => ({ ...input, id: input?.id ?? (table === 'events' ? `event-${eventSequence++}` : `schedule-${scheduleSequence++}`) }))
          rows.push(...inserted)
          return Promise.resolve(resolve({ data: inserted, error: null }))
        }
        if (operation === 'update') matching.forEach((row) => Object.assign(row, values))
        if (operation === 'upsert') {
          const input = values as Record<string, unknown>
          const found = rows.find((row) => row.event_id === input.event_id && row.team_id === input.team_id)
          if (!found) rows.push({ ...input, id: `link-${rows.length + 1}` })
        }
        return Promise.resolve(resolve({ data: operation === 'select' ? matching : matching, error: null }))
      },
    }
    return query
  }
  return { state, client: { from } as unknown as SupabaseClient }
}

const schedule: TrainingSchedule = {
  id: 'schedule-1', team_id: 'team-1', day_of_week: 2, start_time: '18:00', end_time: '20:00', gym_id: 'gym-1', is_active: true,
}

function baseState(): State {
  return {
    teams: [{ id: 'team-1', name: 'U15', activity_id: 'activity-1', is_active: true, training_rsvp_enabled: true }],
    activities: [{ id: 'activity-1', season_id: 'season-1' }],
    seasons: [{ id: 'season-1', end_date: '2026-09-30', is_active: true }],
    team_training_schedules: [schedule], gyms: [{ id: 'gym-1', name: 'Pala', city: 'Roma' }],
    event_teams: [], events: [], event_attendances: [], rsvp: [],
  }
}

describe('training schedule reconciliation', () => {
  it('is idempotent on retry and keeps the generated event identity', async () => {
    const fake = fakeAdmin(baseState())
    const first = await reconcileTrainingSchedules(fake.client, 'team-1', [schedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))
    const eventId = fake.state.events[0]?.id
    for (const event of fake.state.events) {
      for (const field of ['start_date', 'end_date', 'start_time', 'end_time']) {
        if (typeof event[field] === 'string') event[field] = event[field].replace('.000Z', '+00:00')
      }
    }
    fake.state.event_attendances.push({ event_id: eventId, profile_id: 'athlete-1', status: 'going' })
    const second = await reconcileTrainingSchedules(fake.client, 'team-1', [schedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(fake.state.events).toHaveLength(4)
    expect(fake.state.events.filter((event) => event.id === eventId)).toHaveLength(1)
    expect(second.eventsCreated).toBe(0)
    expect(second.eventsUpdated).toBe(0)
  })

  it('preserves an occurrence with a response when its schedule changes', async () => {
    const fake = fakeAdmin(baseState())
    await reconcileTrainingSchedules(fake.client, 'team-1', [schedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))
    const event = fake.state.events[0]
    fake.state.event_attendances.push({ event_id: event.id, profile_id: 'athlete-1', status: 'going' })
    const changed = { ...schedule, start_time: '19:00', end_time: '21:00' }
    const result = await reconcileTrainingSchedules(fake.client, 'team-1', [changed], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(result.success).toBe(true)
    expect(result.warnings.some((warning) => warning.code === 'manual_event_review')).toBe(true)
    expect(fake.state.events.find((row) => row.id === event.id)?.start_time).toBe(event.start_time)
  })

  it('preserves an occurrence marked as a manual exception', async () => {
    const fake = fakeAdmin(baseState())
    await reconcileTrainingSchedules(fake.client, 'team-1', [schedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))
    const event = fake.state.events[0]
    event.generated_schedule_exception = true
    const result = await reconcileTrainingSchedules(fake.client, 'team-1', [{ ...schedule, start_time: '19:00', end_time: '21:00' }], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(result.warnings.some((warning) => warning.code === 'manual_event_review')).toBe(true)
  })

  it('deactivates every schedule when the submitted set is empty', async () => {
    const fake = fakeAdmin(baseState())
    const result = await reconcileTrainingSchedules(fake.client, 'team-1', [], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(result.success).toBe(true)
    expect(result.schedulesDeactivated).toBe(1)
    expect(fake.state.team_training_schedules[0].is_active).toBe(false)
    expect(fake.state.events).toHaveLength(0)
  })

  it('sets RSVP generation from the team preference without duplicating occurrences', async () => {
    const fake = fakeAdmin(baseState())
    const secondSchedule = { ...schedule, id: 'schedule-2', day_of_week: 3 }
    fake.state.team_training_schedules.push(secondSchedule)
    const first = await reconcileTrainingSchedules(fake.client, 'team-1', [schedule, secondSchedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(first.success).toBe(true)
    expect(fake.state.events).toHaveLength(8)
    expect(fake.state.events.every((event) => event.requires_confirmation === true)).toBe(true)

    fake.state.teams[0].training_rsvp_enabled = false
    const second = await reconcileTrainingSchedules(fake.client, 'team-1', [schedule, secondSchedule], 'admin-1', new Date('2026-09-07T10:00:00.000Z'))

    expect(second.success).toBe(true)
    expect(fake.state.events).toHaveLength(8)
    expect(fake.state.events.every((event) => event.requires_confirmation === false)).toBe(true)
  })
})
