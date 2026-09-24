import { getProposedRolloverTeamCode, getRolloverSeasonContext } from './rollover'

const source = { id: 'season-2627', name: 'Stagione 2026/2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true }
const firstTarget = { id: 'season-2728', name: 'Stagione 2027/2028', start_date: '2027-09-01', end_date: '2028-06-30', is_active: false }
const laterTarget = { id: 'season-2829', name: 'Stagione 2028/2029', start_date: '2028-09-01', end_date: '2029-06-30', is_active: false }

describe('season rollover context', () => {
  it('uses the single active season and the nearest future inactive draft', () => {
    const context = getRolloverSeasonContext([
      { id: 'season-2526', name: 'Stagione 2025/2026', start_date: '2025-09-01', end_date: '2026-06-30', is_active: false },
      laterTarget,
      source,
      firstTarget,
    ])

    expect(context.source?.id).toBe(source.id)
    expect(context.targets.map((season) => season.id)).toEqual([firstTarget.id, laterTarget.id])
    expect(context.defaultTarget?.id).toBe(firstTarget.id)
  })

  it('derives a team code suffix from the selected target dates', () => {
    expect(getProposedRolloverTeamCode('U16', firstTarget)).toBe('U16-2728')
  })
})
