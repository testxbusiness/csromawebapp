import { render, screen } from '@testing-library/react'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { canConfirmAthleteAttendance } from '@/lib/athlete/calendar-permissions'

describe('DelegatedAccessDenied', () => {
  it('composes the denied state from FeedbackState and preserves contextual copy', () => {
    const { container } = render(<DelegatedAccessDenied section="la dashboard" profileName="Luca Rossi" />)

    expect(container.querySelector('.cs-feedback-state--denied')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Accesso non abilitato')
    expect(screen.getByText('Non hai il permesso di visualizzare la dashboard per Luca Rossi. L’amministratore può modificare i permessi della relazione.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Torna alla dashboard' }).getAttribute('href')).toBe('/dashboard')
  })

  it('keeps confirmation permission scoped to the delegated family relationship', () => {
    expect(canConfirmAthleteAttendance('family_member', 'family', 'athlete-1', false)).toBe(false)
    expect(canConfirmAthleteAttendance('family_member', 'family', 'athlete-1', true)).toBe(true)
    expect(canConfirmAthleteAttendance('athlete', 'personal', null, false)).toBe(true)
    expect(canConfirmAthleteAttendance('athlete', 'family', null, true)).toBe(false)
  })
})
