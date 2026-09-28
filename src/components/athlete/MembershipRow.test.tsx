import { render, screen } from '@testing-library/react'
import { MembershipRow } from './MembershipRow'

describe('MembershipRow', () => {
  it('renders the team-specific jersey number and team context', () => {
    render(
      <MembershipRow
        membership={{
          id: 'membership-1',
          jersey_number: 7,
          team: { id: 'team-1', name: 'U16', code: 'U16-E', activity: { name: 'Volley' } },
        }}
      />,
    )

    expect(screen.getByText('U16')).toBeTruthy()
    expect(screen.getByText(/Volley · U16-E/)).toBeTruthy()
    expect(screen.getByText('#7')).toBeTruthy()
  })

  it('keeps different jersey numbers independent across memberships', () => {
    const { rerender } = render(
      <MembershipRow
        membership={{ id: 'membership-1', jersey_number: 7, team: { id: 'team-1', name: 'U16', code: 'U16', activity: null } }}
      />,
    )

    expect(screen.getByText('#7')).toBeTruthy()
    rerender(
      <MembershipRow
        membership={{ id: 'membership-2', jersey_number: 12, team: { id: 'team-2', name: 'U18', code: 'U18', activity: null } }}
      />,
    )

    expect(screen.queryByText('#7')).toBeNull()
    expect(screen.getByText('#12')).toBeTruthy()
  })

  it('keeps the membership row non-interactive for a read-only subject', () => {
    const onOpen = jest.fn()
    render(
      <MembershipRow
        readOnly
        onOpen={onOpen}
        membership={{ id: 'membership-2', jersey_number: 12, team: { id: 'team-2', name: 'U18', code: 'U18', activity: null } }}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('#12')).toBeTruthy()
  })
})
