export type AthleteEventKind = 'training' | 'match' | 'meeting' | 'other'

const EVENT_KIND_LABELS: Record<AthleteEventKind, string> = {
  training: 'Allenamento',
  match: 'Partita',
  meeting: 'Riunione',
  other: 'Altro',
}

/** Returns a user-facing label only for event kinds supported by the contract. */
export function eventKindLabel(kind: string | null | undefined): string | null {
  if (!kind || !(kind in EVENT_KIND_LABELS)) return null
  return EVENT_KIND_LABELS[kind as AthleteEventKind]
}
