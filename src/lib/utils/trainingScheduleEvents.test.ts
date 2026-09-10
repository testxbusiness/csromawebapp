import { generateRomeOccurrenceDates } from './trainingScheduleEvents'

describe('training schedule occurrence generation', () => {
  it('includes today only when the start time has not passed', () => {
    const before = generateRomeOccurrenceDates(2, new Date('2026-09-08T15:00:00.000Z'), '2026-09-15', '18:00', '20:00')
    const after = generateRomeOccurrenceDates(2, new Date('2026-09-08T16:30:00.000Z'), '2026-09-15', '18:00', '20:00')

    expect(before[0].localDate).toBe('2026-09-08')
    expect(after[0].localDate).toBe('2026-09-15')
  })

  it('uses Europe/Rome across the daylight-saving transition', () => {
    const occurrences = generateRomeOccurrenceDates(0, new Date('2026-10-01T10:00:00.000Z'), '2026-11-08', '18:00', '20:00')
    const beforeTransition = occurrences.find((occurrence) => occurrence.localDate === '2026-10-18')
    const afterTransition = occurrences.find((occurrence) => occurrence.localDate === '2026-11-01')

    expect(beforeTransition?.start.toISOString()).toBe('2026-10-18T16:00:00.000Z')
    expect(afterTransition?.start.toISOString()).toBe('2026-11-01T17:00:00.000Z')
  })

  it('does not generate beyond the inclusive season end', () => {
    const occurrences = generateRomeOccurrenceDates(1, new Date('2026-09-01T08:00:00.000Z'), '2026-09-14', '18:00', '20:00')
    expect(occurrences.map((occurrence) => occurrence.localDate)).toEqual(['2026-09-07', '2026-09-14'])
  })
})
