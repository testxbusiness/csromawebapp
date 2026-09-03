import {
  EVENT_KINDS,
  eventKindLabel,
  eventKindVisual,
  type EventKind,
} from './event-kind'

describe('shared event kind visual contract', () => {
  it.each([
    ['training', 'Allenamento', 'cs-event-kind cs-event-kind--training'],
    ['match', 'Partita', 'cs-event-kind cs-event-kind--match'],
    ['meeting', 'Riunione', 'cs-event-kind cs-event-kind--meeting'],
    ['other', 'Altro', 'cs-event-kind cs-event-kind--other'],
  ] as const)('maps %s to its accessible visual metadata', (kind, label, className) => {
    const visual = eventKindVisual(kind)

    expect(visual).toMatchObject({
      label,
      ariaLabel: `Tipo evento: ${label}`,
      className,
    })
    expect(visual?.colorToken).toBe(`var(--cs-event-${kind})`)
    expect(visual?.surfaceToken).toBe(`var(--cs-event-${kind}-surface)`)
    expect(visual?.foregroundToken).toBe(`var(--cs-event-${kind}-foreground)`)
  })

  it('exposes all supported kinds in stable order', () => {
    expect(EVENT_KINDS).toEqual(['training', 'match', 'meeting', 'other'])
  })

  it.each([undefined, null, '', 'unknown', 'success', 'warning', 'danger', 'selected'])(
    'does not create visual metadata for unsupported kind %s',
    (kind) => {
      expect(eventKindVisual(kind)).toBeNull()
      expect(eventKindLabel(kind)).toBeNull()
    },
  )

  it('keeps event colors namespaced away from operational status tokens', () => {
    const visuals = EVENT_KINDS.map((kind: EventKind) => eventKindVisual(kind))

    expect(visuals.every((visual) => visual?.colorToken.startsWith('var(--cs-event-'))).toBe(true)
    expect(visuals.every((visual) => !visual?.colorToken.includes('--cs-success'))).toBe(true)
    expect(visuals.every((visual) => !visual?.colorToken.includes('--cs-warning'))).toBe(true)
    expect(visuals.every((visual) => !visual?.colorToken.includes('--cs-danger'))).toBe(true)
    expect(visuals.every((visual) => !visual?.colorToken.includes('--cs-surface-selected'))).toBe(true)
  })
})
