import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('renders every supported kind, keeps an unknown kind textual, and repeats multiday events', () => {
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[
          { id: 'training', title: 'Allenamento', start: new Date(2026, 8, 7, 18), end: new Date(2026, 8, 7, 19), eventKind: 'training' },
          { id: 'match', title: 'Partita', start: new Date(2026, 8, 8, 18), end: new Date(2026, 8, 8, 20), eventKind: 'match' },
          { id: 'meeting', title: 'Riunione', start: new Date(2026, 8, 9, 18), end: new Date(2026, 8, 9, 19), eventKind: 'meeting' },
          { id: 'other', title: 'Altro', start: new Date(2026, 8, 10, 18), end: new Date(2026, 8, 10, 19), eventKind: 'other' },
          { id: 'multiday', title: 'Stage', start: new Date(2026, 8, 11, 18), end: new Date(2026, 8, 13, 12), eventKind: 'legacy' },
        ]}
        onNavigate={jest.fn()}
      />,
    )

    expect(document.querySelectorAll('.cs-mobile-month-calendar__indicator').length).toBe(4)
    expect(screen.getAllByText('Stage')).toHaveLength(3)
    const stageDay = screen.getByRole('button', { name: /venerdì 11 settembre, 1 eventi/i })
    expect(screen.getByRole('button', { name: /sabato 12 settembre, 1 eventi/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /domenica 13 settembre, 1 eventi/i })).toBeTruthy()
    fireEvent.click(stageDay)
    expect(screen.getByText('Tipo non disponibile')).toBeTruthy()
  })

  it('sorts the selected day agenda by local start time and exposes keyboard navigation', async () => {
    const user = userEvent.setup()
    const onNavigate = jest.fn()
    render(
      <MonthlyMobileCalendar
        currentDate={currentDate}
        events={[
          { id: 'late', title: 'Evento tardi', start: new Date(2026, 8, 7, 20), end: new Date(2026, 8, 7, 21), eventKind: 'other' },
          { id: 'early', title: 'Evento presto', start: new Date(2026, 8, 7, 8), end: new Date(2026, 8, 7, 9), eventKind: 'training' },
        ]}
        onNavigate={onNavigate}
      />,
    )

    const agenda = document.querySelector('.cs-mobile-month-calendar__agenda')
    expect(agenda).toBeTruthy()
    const eventButtons = within(agenda as HTMLElement).getAllByRole('button')
    expect(eventButtons[0]).toHaveTextContent('Evento presto')
    expect(eventButtons[1]).toHaveTextContent('Evento tardi')

    await user.click(screen.getByRole('button', { name: 'Mese precedente' }))
    await user.click(screen.getByRole('button', { name: 'Mese successivo' }))
    await user.click(screen.getByRole('button', { name: 'Oggi' }))
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'prev')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'next')
    expect(onNavigate).toHaveBeenNthCalledWith(3, 'today')
  })
})
