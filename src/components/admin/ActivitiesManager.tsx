'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import ActivityModal from '@/components/admin/ActivityModal'

interface Activity {
  id?: string
  name: string
  description?: string
  season_id: string
  created_at?: string
  updated_at?: string
  seasons?: {
    name: string
  }
}

interface Season {
  id: string
  name: string
  is_active: boolean
}

export default function ActivitiesManager() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadActivities()
    loadSeasons()
  }, [])

  const loadActivities = async () => {
    const { data: activitiesData } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })

    if (activitiesData) {
      // Get season names for each activity
      const activitiesWithSeasons = await Promise.all(
        activitiesData.map(async (activity) => {
          if (activity.season_id) {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('name')
              .eq('id', activity.season_id)
              .single()
            
            return {
              ...activity,
              seasons: seasonData ? { name: seasonData.name } : null
            }
          }
          return { ...activity, seasons: null }
        })
      )
      
      setActivities(activitiesWithSeasons)
    } else {
      setActivities([])
    }
    setLoading(false)
  }

  const loadSeasons = async () => {
    const { data } = await supabase
      .from('seasons')
      .select('id, name, is_active')
      .order('start_date', { ascending: false })

    setSeasons(data || [])
  }

  const handleCreateActivity = async (activityData: Omit<Activity, 'id'>) => {
    const { error } = await supabase
      .from('activities')
      .insert([activityData])

    if (!error) {
      setShowModal(false)
      setEditingActivity(null)
      loadActivities()
    }
  }

  const handleUpdateActivity = async (id: string, activityData: Partial<Activity>) => {
    const { error } = await supabase
      .from('activities')
      .update(activityData)
      .eq('id', id)

    if (!error) {
      setShowModal(false)
      setEditingActivity(null)
      loadActivities()
    }
  }

  const handleDeleteActivity = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa attività? Verranno eliminate anche tutte le squadre collegate.')) {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id)

      if (!error) {
        loadActivities()
      }
    }
  }

  const exportActivitiesToExcel = () => {
    exportToExcel(activities, [
      { key: 'name', title: 'Nome Attività', width: 20 },
      { key: 'description', title: 'Descrizione', width: 30 },
      { key: 'seasons', title: 'Stagione', width: 15, format: (val) => val?.name || '' },
      { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
    ], {
      filename: 'attivita_csroma',
      sheetName: 'Attività',
      headerStyle: { fill: { fgColor: { rgb: '9B59B6' } } }
    })
  }

  if (loading) {
    return <div className="p-4">Caricamento attività...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Discipline Sportive</h2>
        <div className="flex gap-3">
          <button
            onClick={exportActivitiesToExcel}
            className="cs-btn cs-btn--outline"
          >
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button
            onClick={() => {
              setEditingActivity(null)
              setShowModal(true)
            }}
            className="cs-btn cs-btn--primary"
          >
            Nuova Attività
          </button>
        </div>
      </div>

      <ActivityModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingActivity(null) }}
        activity={editingActivity}
        seasons={seasons}
        onCreate={handleCreateActivity}
        onUpdate={handleUpdateActivity}
      />

      <div className="cs-card cs-card--primary overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrizione</th>
              <th>Stagione</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id}>
                <td>
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">⚽</div>
                    <div className="text-sm font-medium">{activity.name}</div>
                  </div>
                </td>
                <td>
                  <div className="text-sm text-secondary max-w-xs truncate">
                    {activity.description || 'Nessuna descrizione'}
                  </div>
                </td>
                <td>
                  <div className="text-sm">{activity.seasons?.name}</div>
                </td>
                <td className="text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingActivity(activity)
                      setShowModal(true)
                    }}
                    className="cs-btn cs-btn--outline cs-btn--sm"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteActivity(activity.id!)}
                    className="cs-btn cs-btn--danger cs-btn--sm"
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-4 space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="cs-card">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚽</div>
                <div className="flex-1">
                  <div className="font-semibold">{activity.name}</div>
                  <div className="text-sm text-secondary">{activity.description || 'Nessuna descrizione'}</div>
                  <div className="mt-2 text-sm"><strong>Stagione:</strong> {activity.seasons?.name || '-'}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setEditingActivity(activity); setShowModal(true) }}
                  className="cs-btn cs-btn--outline cs-btn--sm flex-1"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDeleteActivity(activity.id!)}
                  className="cs-btn cs-btn--danger cs-btn--sm flex-1"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        {activities.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-secondary mb-4">
              <span className="text-4xl">⚽</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Nessuna attività creata</h3>
            <p className="text-secondary mb-4">
              Crea la tua prima attività sportiva per iniziare a organizzare le discipline della società.
            </p>
            <button
              onClick={() => {
                setEditingActivity(null)
                setShowModal(true)
              }}
              className="cs-btn cs-btn--primary"
            >
              Crea la tua prima attività
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityForm({ 
  activity, 
  seasons,
  onSubmit, 
  onCancel 
}: { 
  activity: Activity | null
  seasons: Season[]
  onSubmit: (data: Omit<Activity, 'id'>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: activity?.name || '',
    description: activity?.description || '',
    season_id: activity?.season_id || (seasons.find(s => s.is_active)?.id || '')
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const predefinedActivities = [
    { name: 'Calcio', icon: '⚽' },
    { name: 'Pallavolo', icon: '🏐' },
    { name: 'Basket', icon: '🏀' },
    { name: 'Tennis', icon: '🎾' },
    { name: 'Nuoto', icon: '🏊' },
    { name: 'Atletica', icon: '🏃' },
    { name: 'Pallamano', icon: '🤾' },
    { name: 'Rugby', icon: '🏈' }
  ]

  return (
      <div className="cs-card p-6">
      <h3 className="text-lg font-semibold mb-4">
        {activity ? 'Modifica Attività' : 'Nuova Attività Sportiva'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="cs-field__label">
            Nome Attività *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="cs-input"
            placeholder="Es: Calcio, Pallavolo, Basket..."
          />
          
          {!activity && (
            <div className="mt-2">
              <p className="text-xs text-secondary mb-2">Attività predefinite:</p>
              <div className="flex flex-wrap gap-2">
                {predefinedActivities.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, name: preset.name })}
                    className="cs-btn cs-btn--ghost cs-btn--sm"
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="cs-field__label">
            Descrizione
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="cs-textarea"
            placeholder="Descrizione dell'attività sportiva (opzionale)"
          />
        </div>

        <div>
          <label className="cs-field__label">
            Stagione *
          </label>
          <select
            required
            value={formData.season_id}
            onChange={(e) => setFormData({ ...formData, season_id: e.target.value })}
            className="cs-select"
          >
            <option value="">Seleziona una stagione</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} {season.is_active && '(Attiva)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="cs-btn cs-btn--ghost">Annulla</button>
          <button type="submit" className="cs-btn cs-btn--primary">{activity ? 'Aggiorna' : 'Crea'} Attività</button>
        </div>
      </form>
    </div>
  )
}
