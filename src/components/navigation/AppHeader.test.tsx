import { render, screen } from '@testing-library/react'
import AppHeader from './AppHeader'

describe('AppHeader brand treatment', () => {
  it('shows the CSRoma name on the personal athlete dashboard without the generic subtitle', () => {
    const { container } = render(<AppHeader variant="mobile-root" brandTreatment="athlete-dashboard" />)

    expect(container.querySelector('.cs-app-header--athlete-dashboard')).toBeTruthy()
    expect(screen.getByAltText('CSRoma')).toBeTruthy()
    expect(screen.getByText('CSRoma')).toBeTruthy()
    expect(screen.queryByText('Control Center')).toBeNull()
  })

  it('keeps the default brand treatment for other shells', () => {
    render(<AppHeader variant="desktop" />)

    expect(screen.getByText('Control Center')).toBeTruthy()
  })

  it('does not expose a non-functional notifications action in the shell', () => {
    render(<AppHeader variant="mobile-root" />)

    expect(screen.queryByRole('button', { name: 'Notifiche' })).toBeNull()
  })

  it('can omit the mobile menu trigger for the personal athlete shell', () => {
    render(<AppHeader variant="mobile-root" />)

    expect(screen.queryByRole('button', { name: 'Apri navigazione' })).toBeNull()
  })

  it('exposes mobile logout when the shell moves it out of the drawer', () => {
    const onSignOut = jest.fn()
    render(<AppHeader variant="mobile-detail" onSignOut={onSignOut} showMobileSignOut />)

    expect(screen.getAllByRole('button', { name: 'Esci' })).toHaveLength(2)
  })

  it('keeps the regular logout control desktop-scoped', () => {
    render(<AppHeader variant="mobile-detail" onSignOut={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Esci' })).toHaveClass('cs-app-header__desktop-signout')
    expect(screen.queryByRole('button', { name: 'Apri navigazione' })).toBeNull()
  })
})
