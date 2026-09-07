import { fireEvent, render, screen } from '@testing-library/react'
import MonthlyMobileCalendar from './MonthlyMobileCalendar'

describe('MonthlyMobileCalendar', () => {
  const currentDate = new Date(2026, 8, 7)

  it('shows type indicators and opens the selected day agenda on tap', () => {
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[
          { id: 'training', title: 'Allenamento U16', start: new Date(2026, 8, 7, 18), end: new Date(2026, 8, 7, 20), eventKind: 'training' },
          { id: 'match', title: 'Partita esterna', start: new Date(2026, 8, 7, 10), end: new Date(2026, 8, 8, 12), eventKind: 'match' },
        ]}
        onNavigate={jest.fn()}
        onEventClick={jest.fn()}
      />,
    )

    expect(screen.getAllByText('Allenamento U16').length).toBeGreaterThan(0)
    expect(document.querySelector('.cs-mobile-month-calendar__indicator.cs-event-kind--training')).toBeTruthy()
    expect(document.querySelector('.cs-mobile-month-calendar__indicator.cs-event-kind--match')).toBeTruthy()
    expect(screen.getAllByText('Partita esterna').length).toBeGreaterThan(0)
  })

  it('opens the event detail callback from the day agenda', () => {
    const onEventClick = jest.fn()
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[{ id: 'event-1', title: 'Riunione staff', start: new Date(2026, 8, 7, 9), end: new Date(2026, 8, 7, 10), eventKind: 'meeting' }]}
        onNavigate={jest.fn()}
        onEventClick={onEventClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Riunione staff/ }))
    expect(onEventClick).toHaveBeenCalledWith('event-1')
  })
})
