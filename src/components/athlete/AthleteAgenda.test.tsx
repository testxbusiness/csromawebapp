import { render, screen } from '@testing-library/react'
import AthleteAgenda from './AthleteAgenda'
import { groupEventsByDay } from './AthleteAgenda'

const event = (id: string, start_time: string, title = id) => ({
  id,
  title,
  description: null,
  location: null,
  start_time,
  end_time: start_time,
  teams: [],
  event_kind: null,
  requires_confirmation: false,
  confirmation_deadline: null,
  my_attendance: null,
})

describe('athlete agenda', () => {
  it('renders an explicit empty state when there are no events', () => {
    render(
      <AthleteAgenda
        events={[]}
        canRespond
        onAttendanceChange={async () => undefined}
        onEventClick={() => undefined}
      />,
    )

    expect(screen.getByText('Nessun evento trovato.')).toBeTruthy()
    expect(screen.getByLabelText('Agenda eventi')).toBeTruthy()
  })

  it('groups events by local calendar day and sorts days and rows', () => {
    const result = groupEventsByDay([
      event('late', '2026-08-29T18:00:00+02:00'),
      event('next-day', '2026-08-30T09:00:00+02:00'),
      event('early', '2026-08-29T08:00:00+02:00'),
    ])

    expect(result.map((day) => day.key)).toEqual(['2026-08-29', '2026-08-30'])
    expect(result[0].events.map((item) => item.id)).toEqual(['early', 'late'])
  })

  it('skips malformed dates without creating an unusable agenda row', () => {
    expect(groupEventsByDay([event('invalid', 'not-a-date')])).toEqual([])
  })

  it('opens the first chronological event while keeping the compact row metadata visible', () => {
    render(
      <AthleteAgenda
        events={[{
          ...event('training', '2026-08-29T08:00:00+02:00', 'Allenamento mattina'),
          location: 'Palestra CSRoma',
          event_kind: 'training',
          teams: ['U16'],
          requires_confirmation: true,
          confirmation_deadline: null,
          my_attendance: null,
          has_conflict: true,
        }]}
        canRespond
        onAttendanceChange={async () => undefined}
        onEventClick={() => undefined}
      />,
    )

    expect(screen.getByText('Allenamento mattina')).toBeTruthy()
    expect(screen.getByText('Allenamento')).toBeTruthy()
    expect(screen.getByText('Palestra CSRoma')).toBeTruthy()
    expect(screen.getByText(/Conflitto di orario/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apri dettagli' })).toBeTruthy()
  })
})
