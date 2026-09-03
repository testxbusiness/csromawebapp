import { fireEvent, render, screen } from '@testing-library/react'
import { ChampionshipSchedulePanel, NextMatchPanel, RecentResultsPanel, StandingsPanel, StandingRow } from './ChampionshipPanels'
import type { Match } from './types'

const standingRows: StandingRow[] = Array.from({ length: 6 }, (_, index) => ({
  club_team_id: `club-${index + 1}`,
  team_name: index === 2 ? 'CSRoma U16' : `Squadra ${index + 1}`,
  class_points: 18 - index,
  matches_played: 6,
  wins: 6 - index,
  losses: index,
  sets_for: 18 - index,
  sets_against: index + 1,
  points_for: 450 - index,
  points_against: 300 + index,
  is_csr: index === 2,
}))

describe('NextMatchPanel', () => {
  it('shows match context, personal convocation state, meeting status and accessible CTA', () => {
    const onOpenConvocations = jest.fn()
    render(
      <NextMatchPanel
        matchDateLabel="14 settembre · 18:30"
        roundLabel="Giornata 2"
        matchupLabel="CSRoma U16 vs Volley Roma"
        locationLabel="PalaRoma"
        sideLabel="Trasferta"
        opponentLabel="Volley Roma"
        convocationStatusLabel="Sei convocato"
        meetingLabel="Ritrovo 17:15"
        onOpenConvocations={onOpenConvocations}
      />
    )

    expect(screen.getByText('Trasferta')).toBeTruthy()
    expect(screen.getByText('Avversario:')).toBeTruthy()
    expect(screen.getByText('Sei convocato')).toBeTruthy()
    expect(screen.getByText('Ritrovo 17:15')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Vedi convocazione' }))
    expect(onOpenConvocations).toHaveBeenCalledTimes(1)
  })

  it('keeps an explicit empty state when there is no next match', () => {
    render(
      <NextMatchPanel
        empty
        matchDateLabel=""
        roundLabel=""
        matchupLabel=""
        locationLabel=""
        onOpenConvocations={jest.fn()}
      />
    )

    expect(screen.getByText('Nessuna prossima partita CSRoma disponibile.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Vedi convocazione' })).toBeNull()
  })
})

describe('StandingsPanel', () => {
  it('shows the first five rows, identifies CSRoma accessibly and expands the full ranking', () => {
    render(<StandingsPanel rows={standingRows} />)

    expect(screen.getAllByText('Squadra 5').length).toBeGreaterThan(0)
    expect(screen.queryByText('Squadra 6')).toBeNull()
    expect(screen.getAllByText('CSRoma').length).toBe(2)
    expect(screen.getAllByText('18').some((element) => element.className.includes('tabular-nums'))).toBe(true)

    const toggle = screen.getByRole('button', { name: 'Mostra classifica completa (6)' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(screen.getAllByText('Squadra 6').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Mostra prime 5' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Mostra prime 5' }))
    expect(screen.queryByText('Squadra 6')).toBeNull()
  })

  it('does not render an expansion control for five or fewer rows', () => {
    render(<StandingsPanel rows={standingRows.slice(0, 5)} />)

    expect(screen.queryByRole('button', { name: /Mostra classifica completa/ })).toBeNull()
    expect(screen.getAllByText('Squadra 5').length).toBeGreaterThan(0)
  })
})

const matchRows: Match[] = [
  { id: 'match-1', match_day: 1, match_date: '2026-09-01', start_time: '18:00:00', status: 'completed', location_text: 'Pala A', home_club_team_id: 'csr', away_club_team_id: 'opp-1', championship_match_sets: [{ set_number: 1, home_points: 25, away_points: 20 }] },
  { id: 'match-2', match_day: 2, match_date: '2026-09-08', start_time: '18:00:00', status: 'scheduled', location_text: 'Pala B', home_club_team_id: 'opp-2', away_club_team_id: 'csr', championship_match_sets: [] },
  { id: 'match-3', match_day: 3, match_date: '2026-09-15', start_time: '18:00:00', status: 'completed', location_text: 'Pala C', home_club_team_id: 'csr', away_club_team_id: 'opp-3', championship_match_sets: [{ set_number: 1, home_points: 25, away_points: 22 }] },
]

describe('Championship match panels', () => {
  it('keeps recent results compact and excludes the next scheduled match', () => {
    render(<RecentResultsPanel matches={matchRows} teamName={(id) => id === 'csr' ? 'CSRoma' : `Team ${id}`} />)

    expect(screen.getByText('Risultati recenti')).toBeTruthy()
    expect(screen.getByText(/Giornata 3/)).toBeTruthy()
    expect(screen.getByText(/Giornata 1/)).toBeTruthy()
    expect(screen.queryByText(/Giornata 2/)).toBeNull()
    expect(screen.getAllByText('1-0').length).toBe(2)
  })

  it('loads the full selected-group calendar only after opening it', () => {
    render(<ChampionshipSchedulePanel matches={matchRows} teamName={(id) => id === 'csr' ? 'CSRoma' : `Team ${id}`} />)

    expect(screen.queryByText('Pala A')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Mostra calendario' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(screen.getAllByText('Pala A').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Nascondi calendario' }).getAttribute('aria-expanded')).toBe('true')
  })
})
