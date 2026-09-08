import { render, screen } from '@testing-library/react'
import React from 'react'

const gotoDateMock = jest.fn()
import FullCalendarWidget from './FullCalendarWidget'

jest.mock('@fullcalendar/react', () => ({
  __esModule: true,
  default: React.forwardRef(function FullCalendarMock(
    props: { initialView: string; buttonText: Record<string, string> },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      getApi: () => ({
        getDate: () => new Date('2026-08-28T10:00:00Z'),
        gotoDate: gotoDateMock,
      }),
    }))
    return (
      <div
        data-testid="full-calendar"
        data-initial-view={props.initialView}
        data-week-label={props.buttonText.week}
      />
    )
  }),
}))

jest.mock('@fullcalendar/daygrid', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/timegrid', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/interaction', () => ({ __esModule: true, default: {} }))
jest.mock('@fullcalendar/core/locales/it', () => ({ __esModule: true, default: {} }))

describe('FullCalendarWidget', () => {
  const props = {
    initialDate: new Date('2026-08-28T10:00:00Z'),
    events: [],
    onNavigate: jest.fn(),
    onViewChange: jest.fn(),
  }

  it('maps the desktop weekly agenda to timeGridWeek with Italian controls', () => {
    render(<FullCalendarWidget {...props} view="week" />)

    expect(screen.getByTestId('full-calendar').getAttribute('data-initial-view')).toBe('timeGridWeek')
    expect(screen.getByTestId('full-calendar').getAttribute('data-week-label')).toBe('Settimana')
  })

  it('keeps the month view available', () => {
    render(<FullCalendarWidget {...props} view="month" />)

    expect(screen.getByTestId('full-calendar').getAttribute('data-initial-view')).toBe('dayGridMonth')
  })

  it('keeps the mounted desktop calendar synchronized with a new date', () => {
    gotoDateMock.mockClear()
    const { rerender } = render(<FullCalendarWidget {...props} view="month" />)
    const nextDate = new Date('2026-09-08T10:00:00Z')

    rerender(<FullCalendarWidget {...props} initialDate={nextDate} view="month" />)

    expect(gotoDateMock).toHaveBeenCalledWith(nextDate)
  })
})
