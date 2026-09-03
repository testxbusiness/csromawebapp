import { act, render, screen, waitFor } from '@testing-library/react'
import { TeamProvider, useTeamContext } from './TeamContext'

const accessibleContext = {
  selectedProfileId: null as string | null,
  activeArea: 'personal' as 'personal' | 'family',
}

jest.mock('./AccessibleProfileContext', () => ({
  SUBJECT_CONTEXT_CHANGED_EVENT: 'csroma:subject-context-changed',
  useAccessibleProfiles: () => accessibleContext,
}))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ role: null, account: null })),
  useAuthOptional: jest.fn(() => ({ role: null, account: null })),
}))

const authMock = jest.requireMock('@/hooks/useAuth').useAuthOptional as jest.Mock

let currentTeamContext: ReturnType<typeof useTeamContext>

function Probe() {
  currentTeamContext = useTeamContext()
  return <output data-testid="selected-team">{currentTeamContext.selectedTeamId ?? ''}</output>
}

describe('TeamContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
    accessibleContext.selectedProfileId = null
    accessibleContext.activeArea = 'personal'
    authMock.mockReturnValue({ role: null, account: null })
    globalThis.fetch = jest.fn()
  })

  it('rejects a team that is not in the authorized payload', () => {
    render(<TeamProvider><Probe /></TeamProvider>)

    act(() => {
      currentTeamContext.setTeams([{ id: 'team-a', name: 'U16' }, { id: 'team-b', name: 'U18' }])
    })
    act(() => {
      currentTeamContext.setSelectedTeamId('team-b')
    })
    expect(screen.getByTestId('selected-team').textContent).toBe('team-b')

    act(() => currentTeamContext.setSelectedTeamId('team-not-authorized'))
    expect(screen.getByTestId('selected-team').textContent).toBe('team-b')
  })

  it('loads coach teams from the server-owned assignment context', async () => {
    authMock.mockReturnValue({ role: 'coach', account: { ownerProfileId: 'coach-1' } })
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [{ id: 'team-a', name: 'U16', code: 'U16' }] }),
    } as Response)

    render(<TeamProvider><Probe /></TeamProvider>)

    await waitFor(() => expect(currentTeamContext.teams).toEqual([{ id: 'team-a', name: 'U16', code: 'U16' }]))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/coach/teams', expect.objectContaining({ cache: 'no-store' }))
  })

  it('resets selected team and loaded options when the subject changes', async () => {
    const { rerender } = render(<TeamProvider><Probe /></TeamProvider>)

    act(() => {
      currentTeamContext.setTeams([{ id: 'team-a', name: 'U16' }, { id: 'team-b', name: 'U18' }])
    })
    act(() => {
      currentTeamContext.setSelectedTeamId('team-b')
    })
    expect(screen.getByTestId('selected-team').textContent).toBe('team-b')

    accessibleContext.selectedProfileId = 'subject-b'
    rerender(<TeamProvider><Probe /></TeamProvider>)

    await waitFor(() => expect(screen.getByTestId('selected-team').textContent).toBe(''))
    expect(currentTeamContext.teams).toEqual([])
  })

  it('resets the team synchronously when the subject-change transaction starts', () => {
    render(<TeamProvider><Probe /></TeamProvider>)

    act(() => {
      currentTeamContext.setTeams([{ id: 'team-a', name: 'U16' }])
    })
    act(() => currentTeamContext.setSelectedTeamId('team-a'))
    expect(screen.getByTestId('selected-team').textContent).toBe('team-a')

    act(() => {
      window.dispatchEvent(new CustomEvent('csroma:subject-context-changed', {
        detail: { subjectProfileId: 'subject-b' },
      }))
    })

    expect(screen.getByTestId('selected-team').textContent).toBe('')
    expect(currentTeamContext.teams).toEqual([])
  })
})
