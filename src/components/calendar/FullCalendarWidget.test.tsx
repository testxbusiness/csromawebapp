import { render, screen } from '@testing-library/react'
import FullCalendarWidget from './FullCalendarWidget'

jest.mock('@fullcalendar/react', () => ({
  __esModule: true,
  default: (props: { initialView: string; buttonText: Record<string, string> }) => (
    <div
      data-testid="full-calendar"
      data-initial-view={props.initialView}
      data-week-label={props.buttonText.week}
    />
  ),
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
})
