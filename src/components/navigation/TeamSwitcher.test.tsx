import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { TeamSwitcher } from './TeamSwitcher'
import { TeamProvider, useTeamContext } from '@/context/TeamContext'

jest.mock('../../context/AccessibleProfileContext', () => ({
  useAccessibleProfiles: () => ({ selectedProfileId: null, activeArea: 'personal' }),
}))

function SeedTeams({ count }: { count: number }) {
  const { setTeams } = useTeamContext()
  useEffect(() => {
    setTeams(Array.from({ length: count }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `U${16 + index * 2}`,
      code: `U${16 + index * 2}`,
    })))
  }, [count, setTeams])
  return null
}

describe('TeamSwitcher', () => {
  it('is omitted when the subject has fewer than two teams', () => {
    const { container } = render(<TeamProvider><TeamSwitcher /><SeedTeams count={1} /></TeamProvider>)
    expect(container.firstChild).toBeNull()
  })

  it('offers all teams and forwards only a listed team selection', async () => {
    render(<TeamProvider><TeamSwitcher /><SeedTeams count={2} /></TeamProvider>)
    const select = screen.getByLabelText('Squadra')
    expect(screen.getByRole('option', { name: 'Tutte le squadre' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'U16 · U16' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'U18 · U18' })).toBeTruthy()

    fireEvent.change(select, { target: { value: 'team-2' } })
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('team-2'))
  })
})
