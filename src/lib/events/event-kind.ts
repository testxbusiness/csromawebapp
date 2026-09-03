/**
 * Shared visual contract for the event_kind field.
 *
 * Event kind is a category, not an operational status. Keep these tokens and
 * classes separate from attendance, conflict, error and selection semantics.
 */
export const EVENT_KINDS = ['training', 'match', 'meeting', 'other'] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export type EventKindVisual = {
  label: string
  ariaLabel: string
  className: `cs-event-kind cs-event-kind--${EventKind}`
  colorToken: `var(--cs-event-${EventKind})`
  surfaceToken: `var(--cs-event-${EventKind}-surface)`
  foregroundToken: `var(--cs-event-${EventKind}-foreground)`
}

const EVENT_KIND_VISUALS: Record<EventKind, EventKindVisual> = {
  training: {
    label: 'Allenamento',
    ariaLabel: 'Tipo evento: Allenamento',
    className: 'cs-event-kind cs-event-kind--training',
    colorToken: 'var(--cs-event-training)',
    surfaceToken: 'var(--cs-event-training-surface)',
    foregroundToken: 'var(--cs-event-training-foreground)',
  },
  match: {
    label: 'Partita',
    ariaLabel: 'Tipo evento: Partita',
    className: 'cs-event-kind cs-event-kind--match',
    colorToken: 'var(--cs-event-match)',
    surfaceToken: 'var(--cs-event-match-surface)',
    foregroundToken: 'var(--cs-event-match-foreground)',
  },
  meeting: {
    label: 'Riunione',
    ariaLabel: 'Tipo evento: Riunione',
    className: 'cs-event-kind cs-event-kind--meeting',
    colorToken: 'var(--cs-event-meeting)',
    surfaceToken: 'var(--cs-event-meeting-surface)',
    foregroundToken: 'var(--cs-event-meeting-foreground)',
  },
  other: {
    label: 'Altro',
    ariaLabel: 'Tipo evento: Altro',
    className: 'cs-event-kind cs-event-kind--other',
    colorToken: 'var(--cs-event-other)',
    surfaceToken: 'var(--cs-event-other-surface)',
    foregroundToken: 'var(--cs-event-other-foreground)',
  },
}

export type EventKindOption = { value: EventKind; label: string }

export const EVENT_KIND_OPTIONS: readonly EventKindOption[] = EVENT_KINDS.map((kind) => ({
  value: kind,
  label: EVENT_KIND_VISUALS[kind].label,
}))

function isEventKind(kind: string): kind is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(kind)
}

/** Returns the complete visual contract for a supported event kind. */
export function eventKindVisual(kind: string | null | undefined): EventKindVisual | null {
  return kind && isEventKind(kind) ? EVENT_KIND_VISUALS[kind] : null
}

/** Returns a user-facing label only for event kinds supported by the contract. */
export function eventKindLabel(kind: string | null | undefined): string | null {
  return eventKindVisual(kind)?.label ?? null
}
