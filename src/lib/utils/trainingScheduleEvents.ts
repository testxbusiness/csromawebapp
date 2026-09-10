import type { SupabaseClient } from '@supabase/supabase-js'

export type TrainingSchedule = {
  id?: string
  team_id: string
  day_of_week: number
  start_time: string
  end_time: string
  gym_id: string
  is_active?: boolean
}

export type GymConflict = {
  teamName: string
  startTime: string
  endTime: string
}

  /** Stable identity for R2 reconciliation: schedule origin plus local date. */
  export type TrainingOccurrenceIdentity = {
    generated_from_schedule_id: string
    generated_occurrence_date: string
  }

  export function buildTrainingOccurrenceIdentity(
    scheduleId: string,
    occurrenceDate: string,
  ): TrainingOccurrenceIdentity {
    return {
      generated_from_schedule_id: scheduleId,
      generated_occurrence_date: occurrenceDate.slice(0, 10),
    }
  }
  export function getRomeDateParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') }
  }

  function addDays(date: { year: number; month: number; day: number }, days: number): typeof date {
    const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
    return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
  }

  function localRomeDateToUtc(date: { year: number; month: number; day: number }, time: string): Date {
    const [hour, minute, second = 0] = time.split(':').map(Number)
    let utcGuess = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second)
    for (let i = 0; i < 3; i += 1) {
      const local = getRomeDateParts(new Date(utcGuess))
      const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
      utcGuess += Date.UTC(date.year, date.month - 1, date.day, hour, minute) - localAsUtc
    }
    return new Date(utcGuess)
  }

  export function generateRomeOccurrenceDates(
    dayOfWeek: number,
    now: Date,
    seasonEndDate: string,
    startTime: string,
    endTime: string,
  ): Array<{ localDate: string; start: Date; end: Date }> {
    const current = getRomeDateParts(now)
    const end = seasonEndDate.slice(0, 10).split('-').map(Number)
    const endParts = { year: end[0], month: end[1], day: end[2] }
    const today = { year: current.year, month: current.month, day: current.day }
    const todayWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay()
    let offset = (dayOfWeek - todayWeekday + 7) % 7
    if (offset === 0) {
      const [hour, minute] = startTime.split(':').map(Number)
      if (current.hour > hour || (current.hour === hour && current.minute >= minute)) offset = 7
    }
    let occurrence = addDays(today, offset)
    const result: Array<{ localDate: string; start: Date; end: Date }> = []
    while (Date.UTC(occurrence.year, occurrence.month - 1, occurrence.day) <= Date.UTC(endParts.year, endParts.month - 1, endParts.day)) {
      const localDate = `${occurrence.year.toString().padStart(4, '0')}-${occurrence.month.toString().padStart(2, '0')}-${occurrence.day.toString().padStart(2, '0')}`
      const start = localRomeDateToUtc(occurrence, startTime)
      const [endHour, endMinute, endSecond = 0] = endTime.split(':').map(Number)
      const rawEnd = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:${endSecond.toString().padStart(2, '0')}`
      result.push({ localDate, start, end: localRomeDateToUtc(occurrence, rawEnd) })
      occurrence = addDays(occurrence, 7)
    }
    return result
  }
  export async function checkGymScheduleConflicts(
    gymId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string,
    supabase?: SupabaseClient
  ): Promise<GymConflict[]> {
    if (!supabase) return []
    // Usa la funzione SQL se disponibile, altrimenti query diretta
    try {
      const { data, error } = await supabase.rpc('check_gym_schedule_conflicts', {
        p_gym_id: gymId,
        p_day_of_week: dayOfWeek,
        p_start_time: startTime,
        p_end_time: endTime,
        p_exclude_schedule_id: excludeScheduleId || null,
      })
      if (error) throw error
      return data?.map((row: any) => ({
        teamName: row.team_name,
        startTime: row.conflict_start,
        endTime: row.conflict_end,
      })) || []
    } catch (error) {
      console.error('Errore check conflitti:', error)
      return []
    }
  }
