import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ChampionshipConvocationModal } from './ChampionshipConvocationModal'
import type { ClubTeam, Match } from './types'

const match: Match = { id: 'match-1', match_day: 1, match_date: '2026-09-01', start_time: '18:00:00', status: 'scheduled', location_text: 'Pala Roma', home_club_team_id: 'club-a', away_club_team_id: 'club-b' }
const clubTeam: ClubTeam = { id: 'club-a', code: 'U16', name: 'CSRoma U16', is_home_club: true, team_id: 'team-a' }

function renderModal(overrides: Partial<ComponentProps<typeof ChampionshipConvocationModal>> = {}) {
  return render(<ChampionshipConvocationModal
    open
    onOpenChange={jest.fn()}
    match={match}
    clubTeamName={(id) => id === 'club-a' ? 'CSRoma U16' : 'Avversari'}
    clubTeams={[{ clubTeam }]}
    selectedClubTeamId="club-a"
    onClubTeamChange={jest.fn()}
    selectedClubTeam={clubTeam}
    loading={false}
    mode="coach"
    convocation={null}
    teamMembers={[{ id: 'member-a', profile_id: 'profile-a', jersey_number: 7, profiles: { first_name: 'Luca', last_name: 'Rossi' } }]}
    selection={new Set(['member-a'])}
    canEdit
    saving={false}
    onToggle={jest.fn()}
    onSave={jest.fn()}
    {...overrides}
  />)
}

describe('ChampionshipConvocationModal', () => {
  it('shows the final recipient count and requires confirmation before saving a draft', async () => {
    const onSave = jest.fn()
    renderModal({ onSave })

    expect(screen.getByText('1 atleti selezionati')).toBeTruthy()
    const prepare = screen.getByRole('button', { name: 'Prepara convocazione' })
    fireEvent.click(prepare)
    expect(screen.getByRole('button', { name: 'Conferma 1 destinatari' })).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Conferma 1 destinatari' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('1 atleti selezionati')).toBeTruthy())
  })

  it('uses the update CTA for an existing published convocation and disables editing when unauthorized', () => {
    renderModal({
      canEdit: false,
      convocation: { id: 'convocation-1', match_id: match.id, championship_club_team_id: clubTeam.id, championship_match_convocation_members: [{ team_member_id: 'member-a' }] },
    })

    const button = screen.getByRole('button', { name: 'Aggiorna convocazione' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
