import { resolveActiveSeason } from './active-season'

function clientFor(data: unknown, error: unknown = null) {
  const query = {
    from: jest.fn(), select: jest.fn(), eq: jest.fn(), limit: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error })),
  }
  query.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

function teamClientFor(data: unknown, error: unknown = null) {
  const query = {
    from: jest.fn(), select: jest.fn(), eq: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error })),
  }
  query.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('resolveActiveSeason', () => {
  it('returns null when there is no active season', async () => {
    await expect(resolveActiveSeason(clientFor([]) as never)).resolves.toBeNull()
  })

  it('rejects an inconsistent database with more than one active season', async () => {
    const seasons = [
      { id: 'one', name: 'One', start_date: '2025-09-01', end_date: '2026-06-30', is_active: true },
      { id: 'two', name: 'Two', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true },
    ]
    await expect(resolveActiveSeason(clientFor(seasons) as never)).rejects.toHaveProperty('status', 500)
  })
})

describe('resolveActiveSeasonTeamIds', () => {
  it('resolves teams through their season relationship in one query', async () => {
    const { resolveActiveSeasonTeamIds } = await import('./active-season')
    const client = teamClientFor([
      { id: 'team-1', activities: { season_id: 'season-1' } },
      { id: 'team-2', activities: { season_id: 'season-1' } },
    ])

    await expect(resolveActiveSeasonTeamIds(client as never, 'season-1', { filterBySeasonRelation: true })).resolves.toEqual(['team-1', 'team-2'])
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('teams')
    expect(client.select).toHaveBeenCalledWith('id, activities!inner(season_id)')
    expect(client.eq).toHaveBeenCalledWith('activities.season_id', 'season-1')
  })
})
