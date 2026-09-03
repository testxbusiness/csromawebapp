import { eventKindLabel } from './event-kind'

describe('event kind labels', () => {
  it.each([
    ['training', 'Allenamento'],
    ['match', 'Partita'],
    ['meeting', 'Riunione'],
    ['other', 'Altro'],
  ])('formats the supported %s kind', (kind, label) => {
    expect(eventKindLabel(kind)).toBe(label)
  })

  it.each([undefined, null, '', 'unknown'])('does not invent a label for %s', (kind) => {
    expect(eventKindLabel(kind)).toBeNull()
  })
})
