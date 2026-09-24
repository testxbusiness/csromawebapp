import { createAdminClient } from '@/lib/supabase/server'
import { getTeamPreview, teamChoicesSchema } from './season-rollover-teams'

jest.mock('@/lib/supabase/server', () => ({ createAdminClient: jest.fn() }))

const sourceSeasonId = '11111111-1111-4111-8111-111111111111'
const targetSeasonId = '22222222-2222-4222-8222-222222222222'
const sourceActivityId = '33333333-3333-4333-8333-333333333333'
const targetActivityId = '44444444-4444-4444-8444-444444444444'
const sourceTeamId = '55555555-5555-4555-8555-555555555555'
const targetTeamId = '66666666-6666-4666-8666-666666666666'

type Row = Record<string, unknown>

function query(data: Row[] | Row | null, error: null = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error }),
    then: (resolve: (value: { data: Row[] | Row | null; error: null }) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve, reject),
  }
  return builder
}

describe('season rollover team service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    let teamsCall = 0
    let seasonsCall = 0
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'seasons') {
          seasonsCall += 1
          return query(seasonsCall === 1
            ? { id: sourceSeasonId, start_date: '2026-09-01', end_date: '2027-06-30', is_active: true }
            : { id: targetSeasonId, start_date: '2027-09-01', end_date: '2028-06-30', is_active: false })
        }
        if (table === 'activities') return query([
          { id: sourceActivityId, name: 'U16', season_id: sourceSeasonId },
          { id: targetActivityId, name: 'U16 target', season_id: targetSeasonId },
        ])
        if (table === 'teams') {
          teamsCall += 1
          return query(teamsCall === 1
            ? [{ id: sourceTeamId, name: 'U16 Roma', code: 'U16-2627', activity_id: sourceActivityId, is_active: true }]
            : [{ id: targetTeamId, name: 'U16 Roma', code: 'U16-2728', activity_id: targetActivityId, is_active: true }])
        }
        if (table === 'season_rollover_structure_maps') return query([{ source_id: sourceActivityId, target_id: targetActivityId }])
        return query([])
      },
    })
  })

  it('derives the proposed target activity and code from the approved mapping and target dates', async () => {
    const preview = await getTeamPreview(sourceSeasonId, targetSeasonId)
    expect(preview.teams[0]).toMatchObject({
      mappedActivity: { id: targetActivityId },
      proposedCode: 'U16-2728',
      targetMatches: [{ id: targetTeamId }],
    })
  })

  it('rejects duplicate source choices before a batch can be sent', () => {
    const result = teamChoicesSchema.safeParse([
      { sourceId: sourceTeamId, choice: 'skip' },
      { sourceId: sourceTeamId, choice: 'skip' },
    ])
    expect(result.success).toBe(false)
  })
})
