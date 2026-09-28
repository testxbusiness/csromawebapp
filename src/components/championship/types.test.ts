import { isProfileConvoked, type Convocation } from './types'

describe('isProfileConvoked', () => {
  const convocation: Convocation = {
    match_id: 'match-1',
    championship_club_team_id: 'club-team-1',
    championship_match_convocation_members: [
      { team_member_id: 'member-1', profile_id: 'athlete-1' },
      { team_member_id: 'member-2', team_members: { profile_id: 'athlete-2' } },
    ],
  }

  it('recognizes a personal athlete profile saved directly on the convocation member', () => {
    expect(isProfileConvoked(convocation, 'athlete-1')).toBe(true)
  })

  it('recognizes a profile through its team membership and rejects other athletes', () => {
    expect(isProfileConvoked(convocation, 'athlete-2')).toBe(true)
    expect(isProfileConvoked(convocation, 'athlete-3')).toBe(false)
  })
})
