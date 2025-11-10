'use client'
  import * as React from 'react'
  import { TrainingSchedule, GymConflict } from '@/lib/utils/trainingScheduleEvents'
  import { Plus, Trash2, AlertTriangle } from 'lucide-react'
  type Gym = {
    id: string
    name: string
    city?: string
  }
  type Props = {
    schedules: TrainingSchedule[]
    onChange: (schedules: TrainingSchedule[]) => void
    gyms: Gym[]
    onCheckConflicts?: (schedule: Partial<TrainingSchedule>) => Promise<GymConflict[]>
  }
  const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunedì' },
    { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' },
    { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' },
    { value: 6, label: 'Sabato' },
    { value: 0, label: 'Domenica' },
  ]
  export default function TrainingScheduleInput({
    schedules,
    onChange,
    gyms,
    onCheckConflicts,
  }: Props) {
    const [conflicts, setConflicts] = React.useState<Map<number, GymConflict[]>>(new Map())
    const addSchedule = () => {
      onChange([
        ...schedules,
        {
          team_id: '', // Verrà impostato dal parent
          day_of_week: 1, // Default: Lunedì
          start_time: '18:00',
          end_time: '20:00',
          gym_id: gyms[0]?.id || '',
          is_active: true,
        },
      ])
    }
    const removeSchedule = (index: number) => {
      onChange(schedules.filter((_, i) => i !== index))
      // Rimuovi anche i conflitti per questo schedule
      const newConflicts = new Map(conflicts)
      newConflicts.delete(index)
      setConflicts(newConflicts)
    }
    const updateSchedule = async (index: number, updates: Partial<TrainingSchedule>) => {
      const updated = schedules.map((s, i) =>
        i === index ? { ...s, ...updates } : s
      )
      onChange(updated)
      // Controlla conflitti se cambia gym, giorno o orari
      if (
        onCheckConflicts &&
        (updates.gym_id || updates.day_of_week !== undefined || updates.start_time || updates.end_time)
      ) {
        const schedule = updated[index]
        if (schedule.gym_id && schedule.day_of_week !== undefined && schedule.start_time && schedule.end_time) {
          const foundConflicts = await onCheckConflicts(schedule)
          const newConflicts = new Map(conflicts)
          if (foundConflicts.length > 0) {
            newConflicts.set(index, foundConflicts)
          } else {
            newConflicts.delete(index)
          }
          setConflicts(newConflicts)
        }
      }
    }
    const validateTime = (index: number) => {
      const schedule = schedules[index]
      if (schedule.start_time && schedule.end_time) {
        const [startH, startM] = schedule.start_time.split(':').map(Number)
        const [endH, endM] = schedule.end_time.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM
        if (endMinutes <= startMinutes) {
          return 'L\'orario di fine deve essere successivo all\'inizio'
        }
      }
      return null
    }
    return (
      <div className="space-y-3">
        {schedules.length === 0 && (
          <div className="text-sm text-secondary p-4 bg-surface-secondary rounded-lg">
            Nessun orario di allenamento configurato. Clicca su "Aggiungi Orario" per iniziare.
          </div>
        )}
        {schedules.map((schedule, index) => {
          const timeError = validateTime(index)
          const scheduleConflicts = conflicts.get(index) || []
          return (
            <div
              key={index}
              className="p-4 bg-surface-secondary rounded-lg border border-border space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Giorno della settimana */}
                <div>
                  <label className="cs-field__label">Giorno *</label>
                  <select
                    className="cs-select"
                    value={schedule.day_of_week}
                    onChange={(e) =>
                      updateSchedule(index, { day_of_week: Number(e.target.value) })
                    }
                    required
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Palestra */}
                <div>
                  <label className="cs-field__label">Palestra *</label>
                  <select
                    className="cs-select"
                    value={schedule.gym_id}
                    onChange={(e) => updateSchedule(index, { gym_id: e.target.value })}
                    required
                  >
                    <option value="">Seleziona palestra</option>
                    {gyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name} {gym.city ? `(${gym.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Orario inizio */}
                <div>
                  <label className="cs-field__label">Ora Inizio *</label>
                  <input
                    type="time"
                    className="cs-input"
                    value={schedule.start_time}
                    onChange={(e) => updateSchedule(index, { start_time: e.target.value })}
                    required
                  />
                </div>
                {/* Orario fine */}
                <div>
                  <label className="cs-field__label">Ora Fine *</label>
                  <input
                    type="time"
                    className="cs-input"
                    value={schedule.end_time}
                    onChange={(e) => updateSchedule(index, { end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              {/* Errori validazione */}
              {timeError && (
                <div className="flex items-start gap-2 text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{timeError}</span>
                </div>
              )}
              {/* Warning conflitti */}
              {scheduleConflicts.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Attenzione: possibile conflitto palestra</div>
                    {scheduleConflicts.map((conflict, i) => (
                      <div key={i} className="mt-1">
                        La squadra <strong>{conflict.teamName}</strong> usa la stessa palestra{' '}
                        {conflict.startTime} - {conflict.endTime}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Bottone elimina */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeSchedule(index)}
                  className="cs-btn cs-btn--ghost cs-btn--sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Rimuovi
                </button>
              </div>
            </div>
          )
        })}
        {/* Bottone aggiungi */}
        <button
          type="button"
          onClick={addSchedule}
          className="cs-btn cs-btn--ghost cs-btn--sm w-full"
          disabled={gyms.length === 0}
        >
          <Plus className="w-4 h-4 mr-1" />
          Aggiungi Orario
        </button>
        {gyms.length === 0 && (
          <p className="text-xs text-secondary text-center">
            Crea almeno una palestra prima di aggiungere orari di allenamento
          </p>
        )}
        {/* Riepilogo */}
        {schedules.length > 0 && (
          <div className="text-xs text-secondary pt-2 border-t border-border">
            {schedules.length} {schedules.length === 1 ? 'allenamento' : 'allenamenti'} settimanali configurati
          </div>
        )}
      </div>
    )
  }
