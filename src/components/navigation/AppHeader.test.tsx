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
})
