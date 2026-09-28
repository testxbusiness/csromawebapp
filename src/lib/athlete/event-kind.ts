// Compatibility entry point for existing athlete consumers. The visual
// contract itself is shared across roles in src/lib/events/event-kind.ts.
export { EVENT_KINDS, eventKindLabel, eventKindVisual } from '@/lib/events/event-kind'
export type {
  EventKind as AthleteEventKind,
  EventKindVisual,
} from '@/lib/events/event-kind'
