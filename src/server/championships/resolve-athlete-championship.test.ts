import { resolveAthleteChampionshipContext, resolveAthleteChampionshipsForSubject } from './resolve-athlete-championship'

const requireSubjectAthleteContext = jest.fn()
jest.mock('@/server/auth/require-subject-profile', () => ({
  requireSubjectAthleteContext: (...args: unknown[]) => requireSubjectAthleteContext(...args),
}))

function clientFor(rows: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const result = rows[table] ?? []
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve(resolve({ data: result, error: null })),
      }
      return query
    },
  } as never
}

describe('resolveAthleteChampionshipsForSubject', () => {
  it('requires the schedule permission before resolving a delegated championship context', async () => {
    const dataClient = clientFor({})
    requireSubjectAthleteContext.mockResolvedValue({
      dataClient,
      profileId: 'athlete-subject',
      permissions: { view_schedule: true },
    })

    await resolveAthleteChampionshipContext({} as never, 'athlete-subject')

    expect(requireSubjectAthleteContext).toHaveBeenCalledWith({}, 'athlete-subject', 'view_schedule')
  })

  it('resolves every authorized team path and does not use the first global championship', async () => {
    const resolution = await resolveAthleteChampionshipsForSubject(clientFor({
      team_members: [
        { team_id: 'team-a', teams: { id: 'team-a', name: 'U16', code: 'U16' } },
        { team_id: 'team-b', teams: { id: 'team-b', name: 'U18', code: 'U18' } },
      ],
      championship_club_teams: [
        { id: 'club-a', championship_id: 'champ-a', team_id: 'team-a', code: 'A', name: 'CSRoma U16', is_home_club: true },
        { id: 'club-a-outsider', championship_id: 'champ-a', team_id: 'team-outsider', code: 'X', name: 'Other U16', is_home_club: false },
        { id: 'club-b', championship_id: 'champ-b', team_id: 'team-b', code: 'B', name: 'CSRoma U18', is_home_club: true },
        { id: 'club-outsider', championship_id: 'champ-global-first', team_id: 'team-outsider', code: 'X', name: 'Other', is_home_club: false },
      ],
      championships: [
        { id: 'champ-global-first', name: 'Campionato globale', status: 'active', sport: 'volley' },
        { id: 'champ-a', name: 'U16 regionale', status: 'active', sport: 'volley' },
        { id: 'champ-b', name: 'U18 regionale', status: 'active', sport: 'volley' },
      ],
      championship_groups: [
        { id: 'group-a', championship_id: 'champ-a', name: 'Girone A', phase: 'regular', sort_order: 0 },
        { id: 'group-b', championship_id: 'champ-b', name: 'Girone B', phase: 'regular', sort_order: 0 },
      ],
      championship_group_teams: [
        { id: 'gt-a', championship_group_id: 'group-a', championship_club_team_id: 'club-a' },
        { id: 'gt-b', championship_group_id: 'group-b', championship_club_team_id: 'club-b' },
      ],
    }), 'athlete-subject')

    expect(resolution.subjectProfileId).toBe('athlete-subject')
    expect(resolution.teams.map((team) => team.id)).toEqual(['team-a', 'team-b'])
    expect(resolution.championships.map((championship) => championship.id)).toEqual(['champ-a', 'champ-b'])
    expect(resolution.championships[0].clubTeams.map((clubTeam) => clubTeam.id)).toEqual(['club-a'])
    expect(resolution.championships[0].groups[0].id).toBe('group-a')
    expect(resolution.paths).toEqual([
      { teamId: 'team-a', championshipId: 'champ-a', groupId: 'group-a' },
      { teamId: 'team-b', championshipId: 'champ-b', groupId: 'group-b' },
    ])
    expect(resolution.initialSelection).toBeNull()
  })

  it('returns an initial selection only for one unambiguous team→championship→group path', async () => {
    const resolution = await resolveAthleteChampionshipsForSubject(clientFor({
      team_members: [{ team_id: 'team-a', teams: { id: 'team-a', name: 'U16' } }],
      championship_club_teams: [{ id: 'club-a', championship_id: 'champ-a', team_id: 'team-a', code: 'A', name: 'U16', is_home_club: true }],
      championships: [{ id: 'champ-a', name: 'Campionato', status: 'active', sport: 'volley' }],
      championship_groups: [{ id: 'group-a', championship_id: 'champ-a', name: 'Girone A', phase: 'regular', sort_order: 0 }],
      championship_group_teams: [{ id: 'gt-a', championship_group_id: 'group-a', championship_club_team_id: 'club-a' }],
    }), 'athlete-subject')

    expect(resolution.initialSelection).toEqual({ teamId: 'team-a', championshipId: 'champ-a', groupId: 'group-a' })
  })

  it('keeps every authorized group path when one athlete has multiple teams and groups', async () => {
    const resolution = await resolveAthleteChampionshipsForSubject(clientFor({
      team_members: [
        { team_id: 'team-a', teams: { id: 'team-a', name: 'U16' } },
        { team_id: 'team-b', teams: { id: 'team-b', name: 'U18' } },
      ],
      championship_club_teams: [
        { id: 'club-a', championship_id: 'champ-a', team_id: 'team-a', code: 'A', name: 'CSRoma U16', is_home_club: true },
        { id: 'club-b', championship_id: 'champ-a', team_id: 'team-b', code: 'B', name: 'CSRoma U18', is_home_club: true },
      ],
      championships: [{ id: 'champ-a', name: 'Campionato unico', status: 'active', sport: 'volley' }],
      championship_groups: [
        { id: 'group-a', championship_id: 'champ-a', name: 'Girone A', phase: 'regular', sort_order: 0 },
        { id: 'group-b', championship_id: 'champ-a', name: 'Girone B', phase: 'regular', sort_order: 1 },
      ],
      championship_group_teams: [
        { id: 'gt-a', championship_group_id: 'group-a', championship_club_team_id: 'club-a' },
        { id: 'gt-b', championship_group_id: 'group-b', championship_club_team_id: 'club-b' },
      ],
    }), 'athlete-subject')

    expect(resolution.championships).toHaveLength(1)
    expect(resolution.championships[0].groups.map((group) => group.id)).toEqual(['group-a', 'group-b'])
    expect(resolution.paths).toEqual([
      { teamId: 'team-a', championshipId: 'champ-a', groupId: 'group-a' },
      { teamId: 'team-b', championshipId: 'champ-a', groupId: 'group-b' },
    ])
    expect(resolution.initialSelection).toBeNull()
  })
})
