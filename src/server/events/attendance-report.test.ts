import { buildAttendanceReport } from './attendance-report'

const profiles = [
  { id: 'athlete-1', first_name: 'Luca', last_name: 'Rossi' },
  { id: 'athlete-2', first_name: 'Marco', last_name: 'Bianchi' },
]

describe('buildAttendanceReport', () => {
  it('uses the current roster minus communicated absences for absence-only events', () => {
    const report = buildAttendanceReport('absence_only', profiles, [
      { profile_id: 'athlete-2', status: 'declined', responded_at: null },
    ])
    expect(report.counts).toEqual(expect.objectContaining({ roster: 2, available: 1, absent: 1 }))
    expect(report.available.map((profile) => profile.id)).toEqual(['athlete-1'])
    expect(report.absent.map((entry) => entry.profile_id)).toEqual(['athlete-2'])
  })
})
