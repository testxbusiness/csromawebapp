import { fireEvent, render, screen } from '@testing-library/react'
import { AthleteChampionshipShell } from './AthleteChampionshipShell'

const championship = { id: 'championship', name: 'U16 Regionale', status: 'active', sport: 'volley' }
const group = { id: 'group', championship_id: 'championship', name: 'Girone A', phase: 'regular', sort_order: 0 }

describe('AthleteChampionshipShell', () => {
  const props = {
    teamLabel: 'U16 · Tutte le squadre',
    championships: [championship],
    selectedChampionship: championship,
    selectedChampionshipId: championship.id,
    onChampionshipChange: jest.fn(),
    groups: [group],
    selectedGroupId: group.id,
    onGroupChange: jest.fn(),
    onGroupSelected: jest.fn(),
  }

  it('keeps unique championship and group levels implicit', () => {
    render(<AthleteChampionshipShell {...props} />)

    expect(screen.getByRole('heading', { name: 'Campionato' })).toBeTruthy()
    expect(screen.queryByLabelText('Campionato')).toBeNull()
    expect(screen.queryByLabelText('Girone')).toBeNull()
  })

  it('shows selectors only for ambiguous resolver paths and emits the selected group', () => {
    const onGroupChange = jest.fn()
    const onGroupSelected = jest.fn()
    render(<AthleteChampionshipShell {...props} championships={[championship, { ...championship, id: 'championship-2', name: 'U18 Regionale' }]} groups={[group, { ...group, id: 'group-2', name: 'Girone B' }]} onGroupChange={onGroupChange} onGroupSelected={onGroupSelected} />)

    expect(screen.getByLabelText('Campionato')).toBeTruthy()
    expect(screen.getByLabelText('Girone')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Girone'), { target: { value: 'group-2' } })
    expect(onGroupChange).toHaveBeenCalledWith('group-2')
    expect(onGroupSelected).toHaveBeenCalledWith('group-2')
  })
})
