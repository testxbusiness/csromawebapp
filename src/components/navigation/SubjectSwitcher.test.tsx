import { render, screen } from '@testing-library/react'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { SubjectSwitcher } from './SubjectSwitcher'

jest.mock('@/context/AccessibleProfileContext', () => ({ useAccessibleProfiles: jest.fn() }))

const profilesMock = useAccessibleProfiles as jest.MockedFunction<typeof useAccessibleProfiles>

describe('SubjectSwitcher', () => {
  it('shows the subject name without the relationship type', () => {
    profilesMock.mockReturnValue({
      profiles: [{
        profile: { id: 'subject-1', first_name: 'Giorgio', last_name: 'Politi', email: null },
        relationship: { id: 'relationship-1', type: 'parent', verified_at: '2026-01-01', permissions: {} as never },
      }],
      selectedProfileId: 'subject-1',
      setSelectedProfileId: jest.fn(),
      activeArea: 'family',
      loading: false,
    } as never)

    render(<SubjectSwitcher variant="mobile" />)

    expect(screen.getByRole('option', { name: 'Giorgio Politi' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /parent/i })).toBeNull()
  })
})
