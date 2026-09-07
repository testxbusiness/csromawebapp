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

  it('selects an empty day without opening an event and offers that date for creation', () => {
    const onEventClick = jest.fn()
    const onCreateEvent = jest.fn()
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[]}
        onNavigate={jest.fn()}
        onEventClick={onEventClick}
        onCreateEvent={onCreateEvent}
      />,
    )

    const day = screen.getByRole('button', { name: /^martedì 8 settembre, nessun evento$/i })
    fireEvent.click(day)

    expect(onEventClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo evento per questa giornata' }))
    expect(onCreateEvent).toHaveBeenCalledWith(expect.objectContaining({
      getFullYear: expect.any(Function),
      getMonth: expect.any(Function),
      getDate: expect.any(Function),
    }))
    expect((onCreateEvent.mock.calls[0][0] as Date).getDate()).toBe(8)
  })

  it('supports a role-specific agenda renderer without wrapping its controls in an event button', () => {
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[{ id: 'event-1', title: 'Partita', start: new Date(2026, 8, 7, 10), end: new Date(2026, 8, 7, 12), eventKind: 'match' }]}
        onNavigate={jest.fn()}
        renderAgendaEvent={(event) => (
          <div>
            <span>{event.title}</span>
            <button type="button">Partecipo</button>
          </div>
        )}
      />,
    )

    expect(screen.getByRole('button', { name: 'Partecipo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Partita/ })).toBeNull()
  })
})
