import { render, screen } from '@testing-library/react'
import RoleSidebar from './RoleSidebar'

const authMock = jest.fn()
const profilesMock = jest.fn()

jest.mock('next/navigation', () => ({ usePathname: () => '/athlete/fees' }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => authMock() }))
jest.mock('@/context/AccessibleProfileContext', () => ({ useAccessibleProfiles: () => profilesMock() }))

describe('RoleSidebar', () => {
  beforeEach(() => {
    authMock.mockReturnValue({ role: 'athlete', account: { roles: ['athlete'] }, loading: false })
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: null, activeArea: 'personal', loading: false, setActiveArea: jest.fn(), setSelectedProfileId: jest.fn() })
  })

  it('keeps the historical fees route active while naming it Amministrazione', () => {
    render(<RoleSidebar />)
    const link = screen.getByRole('link', { name: 'Amministrazione' })
    expect(link.getAttribute('href')).toBe('/athlete/fees')
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('shows family administration when documents alone are authorized', () => {
    authMock.mockReturnValue({ role: 'family_member', account: { roles: ['family_member'] }, loading: false })
    profilesMock.mockReturnValue({ profiles: [], selectedProfile: { relationship: { permissions: { view_schedule: false, receive_messages: false, view_payments: false, view_medical_status: false, view_documents: true } } }, activeArea: 'family', loading: false, setActiveArea: jest.fn(), setSelectedProfileId: jest.fn() })
    render(<RoleSidebar />)
    expect(screen.getByRole('link', { name: 'Amministrazione' }).getAttribute('href')).toBe('/athlete/fees')
  })
})
