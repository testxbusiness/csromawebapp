import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildTrainingOccurrenceIdentity,
  generateRomeOccurrenceDates,
  type TrainingSchedule,
} from '@/lib/utils/trainingScheduleEvents'

type Team = { id: string; name: string; activity_id: string; is_active: boolean; training_rsvp_enabled: boolean }
type Gym = { id: string; name: string; city: string | null }
type ExistingEvent = {
  id: string
  generated_from_schedule_id: string | null
  generated_occurrence_date: string | null
  generated_schedule_exception: boolean
  start_date: string
  end_date: string
  start_time: string
  end_time: string
  title: string | null
  name: string
  description: string | null
  location: string | null
  gym_id: string | null
  activity_id: string | null
  event_kind: string | null
  event_type: string | null
  kind: string | null
}

export type TrainingReconciliationReport = {
  success: boolean
  schedulesCreated: number
  schedulesUpdated: number
  schedulesDeactivated: number
  eventsCreated: number
  eventsUpdated: number
  eventsPreserved: number
  errors: number
  warnings: Array<{ code: string; message: string; eventIds?: string[] }>
}

const EVENT_FIELDS = 'id,generated_from_schedule_id,generated_occurrence_date,generated_schedule_exception,start_date,end_date,start_time,end_time,title,name,description,location,gym_id,activity_id,event_kind,event_type,kind'

function emptyReport(): TrainingReconciliationReport {
  return {
    success: true,
    schedulesCreated: 0,
    schedulesUpdated: 0,
    schedulesDeactivated: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsPreserved: 0,
    errors: 0,
    warnings: [],
  }
}

function addWarning(report: TrainingReconciliationReport, code: string, message: string, eventIds?: string[]) {
  report.warnings.push({ code, message, ...(eventIds?.length ? { eventIds } : {}) })
}

function isProtected(event: ExistingEvent, protectedEventIds: Set<string>) {
  return event.generated_schedule_exception === true || protectedEventIds.has(event.id)
}

function sameInstant(left: string, right: unknown) {
  if (typeof right !== 'string') return false
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  return Number.isFinite(leftTime) && leftTime === rightTime
}

function isSameEvent(event: ExistingEvent, desired: Record<string, unknown>) {
  return sameInstant(event.start_date, desired.start_date) && sameInstant(event.end_date, desired.end_date)
    && sameInstant(event.start_time, desired.start_time) && sameInstant(event.end_time, desired.end_time)
    && (event.title ?? event.name) === desired.title
    && event.description === desired.description && event.location === desired.location
    && event.gym_id === desired.gym_id && event.activity_id === desired.activity_id
}

export async function reconcileTrainingSchedules(
  admin: SupabaseClient,
  teamId: string,
  requestedSchedules: TrainingSchedule[],
  createdBy: string,
  now = new Date(),
): Promise<TrainingReconciliationReport> {
  const report = emptyReport()
  const { data: team, error: teamError } = await admin
    .from('teams')
    .select('id,name,activity_id,is_active,training_rsvp_enabled')
    .eq('id', teamId)
    .maybeSingle()
  if (teamError || !team) return { ...report, success: false, errors: 1, warnings: [{ code: 'team_not_found', message: 'Squadra non trovata' }] }
  const typedTeam = team as Team

  const { data: activity, error: activityError } = await admin.from('activities').select('season_id').eq('id', typedTeam.activity_id).maybeSingle()
  const { data: season, error: seasonError } = activity?.season_id
    ? await admin.from('seasons').select('end_date').eq('id', activity.season_id).eq('is_active', true).maybeSingle()
    : { data: null, error: null }
  if (activityError || seasonError || !season?.end_date) {
    return { ...report, success: false, errors: 1, warnings: [{ code: 'season_not_found', message: 'Nessuna stagione attiva trovata' }] }
  }

  const { data: currentRows, error: currentError } = await admin.from('team_training_schedules').select('*').eq('team_id', teamId)
  if (currentError) return { ...report, success: false, errors: 1, warnings: [{ code: 'schedule_read_failed', message: 'Impossibile leggere gli orari esistenti' }] }
  const current = (currentRows ?? []) as TrainingSchedule[]
  const currentById = new Map(current.filter((schedule) => schedule.id).map((schedule) => [schedule.id as string, schedule]))
  const requestedIds = new Set<string>()

  for (const schedule of requestedSchedules) {
    if (schedule.id) {
      const existing = currentById.get(schedule.id)
      if (!existing) {
        report.errors += 1
        addWarning(report, 'schedule_id_not_owned', `L'orario ${schedule.id} non appartiene alla squadra`)
        continue
      }
      requestedIds.add(schedule.id)
      const { error } = await admin.from('team_training_schedules').update({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        gym_id: schedule.gym_id,
        is_active: schedule.is_active !== false,
      }).eq('id', schedule.id).eq('team_id', teamId)
      if (error) { report.errors += 1; continue }
      report.schedulesUpdated += 1
    } else {
      const { data: inserted, error } = await admin.from('team_training_schedules').insert({
        team_id: teamId,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        gym_id: schedule.gym_id,
        is_active: schedule.is_active !== false,
      }).select('id').single()
      if (error || !inserted?.id) { report.errors += 1; continue }
      requestedIds.add(inserted.id)
      report.schedulesCreated += 1
    }
  }

  const removed = current.filter((schedule) => schedule.id && !requestedIds.has(schedule.id))
  for (const schedule of removed) {
    const { error } = await admin.from('team_training_schedules').update({ is_active: false }).eq('id', schedule.id).eq('team_id', teamId)
    if (error) report.errors += 1
    else report.schedulesDeactivated += 1
  }

  const { data: links, error: linksError } = await admin.from('event_teams').select('event_id').eq('team_id', teamId)
  if (linksError) return { ...report, success: false, errors: report.errors + 1, warnings: [...report.warnings, { code: 'event_links_read_failed', message: 'Impossibile leggere i collegamenti evento-squadra' }] }
  const eventIds = (links ?? []).map((link: { event_id: string }) => link.event_id)
  const { data: eventRows, error: eventsError } = eventIds.length
    ? await admin.from('events').select(EVENT_FIELDS).in('id', eventIds)
    : { data: [], error: null }
  if (eventsError) return { ...report, success: false, errors: report.errors + 1, warnings: [...report.warnings, { code: 'event_read_failed', message: 'Impossibile leggere gli eventi generati' }] }
  const events = (eventRows ?? []) as ExistingEvent[]
  const generatedEvents = events.filter((event) => event.generated_from_schedule_id)
  const legacyEvents = events.filter((event) => !event.generated_from_schedule_id && (event.event_kind === 'training' || event.event_type === 'recurring' || event.kind === 'recurring'))
  if (legacyEvents.length) {
    addWarning(report, 'legacy_training_overlap', 'Rilevati allenamenti legacy non classificati: verificare manualmente eventuali sovrapposizioni.', legacyEvents.map((event) => event.id))
  }

  const generatedIds = generatedEvents.map((event) => event.id)
  const [attendanceResult, rsvpResult] = generatedIds.length
    ? await Promise.all([
      admin.from('event_attendances').select('event_id').in('event_id', generatedIds),
      admin.from('rsvp').select('event_id').in('event_id', generatedIds),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (attendanceResult.error || rsvpResult.error) {
    report.errors += 1
    addWarning(report, 'response_read_failed', 'Impossibile verificare le risposte esistenti: nessuna occorrenza è stata riconciliata.')
    report.success = false
    return report
  }
  const attendanceRows = attendanceResult.data
  const rsvpRows = rsvpResult.data
  const protectedEventIds = new Set<string>([
    ...(attendanceRows ?? []).map((row: { event_id: string }) => row.event_id),
    ...(rsvpRows ?? []).map((row: { event_id: string }) => row.event_id),
  ])
  const eventByIdentity = new Map(generatedEvents.filter((event) => event.generated_occurrence_date && event.generated_from_schedule_id).map((event) => [
    `${event.generated_from_schedule_id}:${event.generated_occurrence_date?.slice(0, 10)}`, event,
  ]))
  const { data: persistedRows, error: persistedError } = await admin
    .from('team_training_schedules')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
  if (persistedError) {
    report.errors += 1
    addWarning(report, 'schedule_refresh_failed', 'Impossibile rileggere gli orari dopo il salvataggio')
    report.success = false
    return report
  }
  const activeSchedules = (persistedRows ?? []) as TrainingSchedule[]
  if (!typedTeam.is_active) {
    report.success = report.errors === 0
    return report
  }
  const persistedScheduleIds = Array.from(new Set([
    ...current.map((schedule) => schedule.id),
    ...activeSchedules.map((schedule) => schedule.id),
  ].filter(Boolean))) as string[]
  if (persistedScheduleIds.length) {
    const { data: globallyGenerated, error: globalGeneratedError } = await admin
      .from('events')
      .select(EVENT_FIELDS)
      .in('generated_from_schedule_id', persistedScheduleIds)
    if (globalGeneratedError) {
      report.errors += 1
      addWarning(report, 'generated_event_read_failed', 'Impossibile verificare le occorrenze già generate')
      report.success = false
      return report
    } else {
      for (const event of (globallyGenerated ?? []) as ExistingEvent[]) {
        const identity = event.generated_occurrence_date && event.generated_from_schedule_id
          ? `${event.generated_from_schedule_id}:${event.generated_occurrence_date.slice(0, 10)}`
          : null
        if (identity && !eventByIdentity.has(identity)) eventByIdentity.set(identity, event)
      }
      const globalIds = (globallyGenerated ?? []).map((event: { id: string }) => event.id)
      if (globalIds.length) {
        const [globalAttendanceResult, globalRsvpResult] = await Promise.all([
          admin.from('event_attendances').select('event_id').in('event_id', globalIds),
          admin.from('rsvp').select('event_id').in('event_id', globalIds),
        ])
        if (globalAttendanceResult.error || globalRsvpResult.error) {
          report.errors += 1
          addWarning(report, 'response_read_failed', 'Impossibile verificare le risposte delle occorrenze già generate.')
          report.success = false
          return report
        } else {
          for (const row of [...(globalAttendanceResult.data ?? []), ...(globalRsvpResult.data ?? [])] as Array<{ event_id: string }>) protectedEventIds.add(row.event_id)
        }
      }
    }
  }
  const gyms = new Map<string, Gym>()
  const gymIds = Array.from(new Set(activeSchedules.map((schedule) => schedule.gym_id)))
  if (gymIds.length) {
    const { data: gymRows, error: gymError } = await admin.from('gyms').select('id,name,city').in('id', gymIds)
    if (gymError) { report.errors += 1; addWarning(report, 'gym_read_failed', 'Impossibile leggere le palestre degli orari attivi') }
    for (const gym of (gymRows ?? []) as Gym[]) gyms.set(gym.id, gym)
  }

  const desiredIdentities = new Set<string>()
  for (const schedule of activeSchedules) {
    const gym = gyms.get(schedule.gym_id)
    if (!gym) { report.errors += 1; continue }
    const occurrences = generateRomeOccurrenceDates(schedule.day_of_week, now, season.end_date, schedule.start_time, schedule.end_time)
    for (const occurrence of occurrences) {
      const identity = buildTrainingOccurrenceIdentity(schedule.id as string, occurrence.localDate)
      desiredIdentities.add(`${identity.generated_from_schedule_id}:${identity.generated_occurrence_date}`)
      const existing = eventByIdentity.get(`${identity.generated_from_schedule_id}:${identity.generated_occurrence_date}`)
      const title = `Allenamento ${typedTeam.name}`
      const location = gym.city ? `${gym.name}, ${gym.city}` : gym.name
      const desired = {
        title, name: title,
        description: `Allenamento settimanale - ${['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][schedule.day_of_week] ?? 'Giorno non valido'}`,
        start_date: occurrence.start.toISOString(), end_date: occurrence.end.toISOString(),
        start_time: occurrence.start.toISOString(), end_time: occurrence.end.toISOString(),
        location, gym_id: gym.id, activity_id: typedTeam.activity_id,
        event_type: 'recurring', event_kind: 'training', recurrence_rule: { frequency: 'weekly', interval: 1 },
        generated_from_schedule_id: schedule.id, generated_occurrence_date: occurrence.localDate,
        generated_schedule_exception: false, created_by: createdBy,
        requires_confirmation: typedTeam.training_rsvp_enabled,
      }
      if (!existing) {
        const { data: inserted, error } = await admin.from('events').insert(desired).select('id').single()
        if (error || !inserted?.id) { report.errors += 1; continue }
        const { error: linkError } = await admin.from('event_teams').upsert({ event_id: inserted.id, team_id: teamId }, { onConflict: 'event_id,team_id' })
        if (linkError) { report.errors += 1; continue }
        report.eventsCreated += 1
        continue
      }
      const { error: existingLinkError } = await admin.from('event_teams').upsert({ event_id: existing.id, team_id: teamId }, { onConflict: 'event_id,team_id' })
      if (existingLinkError) { report.errors += 1; continue }
      const isFuture = new Date(existing.start_date || existing.start_time) > now
      if (!isFuture || isProtected(existing, protectedEventIds)) {
        report.eventsPreserved += 1
        if (isProtected(existing, protectedEventIds)) addWarning(report, 'manual_event_review', 'Evento con risposta o modifica manuale conservato; nessuno spostamento automatico.', [existing.id])
        continue
      }
      if (isSameEvent(existing, desired)) { report.eventsPreserved += 1; continue }
      const { error } = await admin.from('events').update(desired).eq('id', existing.id)
      if (error) { report.errors += 1; continue }
      report.eventsUpdated += 1
    }
  }

  const removedIds = new Set(removed.map((schedule) => schedule.id).filter(Boolean) as string[])
  const knownEvents = Array.from(new Map(Array.from(eventByIdentity.values()).map((event) => [event.id, event])).values())
  const activeIds = new Set(activeSchedules.map((schedule) => schedule.id).filter(Boolean) as string[])
  const obsoleteFuture = knownEvents.filter((event) => {
    if (!event.generated_from_schedule_id || !event.generated_occurrence_date) return false
    if (!removedIds.has(event.generated_from_schedule_id) && !activeIds.has(event.generated_from_schedule_id)) return false
    return new Date(event.start_date || event.start_time) > now
      && !desiredIdentities.has(`${event.generated_from_schedule_id}:${event.generated_occurrence_date.slice(0, 10)}`)
  })
  report.eventsPreserved += obsoleteFuture.length
  const obsoleteProtected = obsoleteFuture.filter((event) => isProtected(event, protectedEventIds))
  if (obsoleteProtected.length) addWarning(report, 'obsolete_event_manual_review', 'Un evento futuro con risposta o modifica manuale non coincide più con l’orario attivo: gestione manuale richiesta.', obsoleteProtected.map((event) => event.id))
  const removedProtected = knownEvents.filter((event) => event.generated_from_schedule_id && removedIds.has(event.generated_from_schedule_id) && isProtected(event, protectedEventIds))
  if (removedProtected.length) addWarning(report, 'removed_schedule_manual_review', 'Orari rimossi con eventi confermati o modificati: eventi conservati per gestione manuale.', removedProtected.map((event) => event.id))
  report.success = report.errors === 0
  return report
}
