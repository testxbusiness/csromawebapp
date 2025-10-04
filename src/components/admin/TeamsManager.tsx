'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportTeams } from '@/lib/utils/excelExport'
import TeamModal from '@/components/admin/TeamModal'

interface Team {
  id?: string
  name: string
  code: string
  activity_id: string
  coach_id?: string
  created_at?: string
  updated_at?: string
  activities?: {
    name: string
    seasons?: {
      name: string
    }
  }
  coach?: {
    first_name: string
    last_name: string
  }
}

interface Activity {
  id: string
  name: string
  season_id: string
  seasons?: {
    name: string
  }
}

interface Coach {
  id: string
  first_name: string
  last_name: string
  email: string
}

export default function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadTeams()
    loadActivities()
    loadCoaches()
  }, [])

  const loadTeams = async () => {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, code, activity_id, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (!teamsData || teamsData.length === 0) {
      setTeams([])
      setLoading(false)
      return
    }

    const teamIds = teamsData.map((team) => team.id)

    const { data: activitiesData } = await supabase
      .from('activities')
      .select('id, name, season_id')
      .in('id', teamsData.map((t) => t.activity_id).filter(Boolean))

    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id, name')

    const { data: teamCoachesData } = await supabase
      .from('team_coaches')
      .select('team_id, coach_id, profiles(first_name, last_name)')
      .in('team_id', teamIds)

    const activityMap = new Map<string, { name: string; season_id: string | null }>()
    activitiesData?.forEach((activity: any) => {
      activityMap.set(activity.id, { name: activity.name, season_id: activity.season_id })
    })

    const seasonMap = new Map<string, string>()
    seasonsData?.forEach((season: any) => {
      seasonMap.set(season.id, season.name)
    })

    const coachMap = new Map<string, { coach_id: string; coach?: { first_name: string; last_name: string } }>()
    teamCoachesData?.forEach((row: any) => {
      if (!coachMap.has(row.team_id)) {
        coachMap.set(row.team_id, {
          coach_id: row.coach_id,
          coach: row.profiles ? { first_name: row.profiles.first_name, last_name: row.profiles.last_name } : undefined
        })
      }
    })

    const teamsWithRelations = teamsData.map((team) => {
      const activityInfo = team.activity_id ? activityMap.get(team.activity_id) : null
      const coachInfo = coachMap.get(team.id)

      return {
        ...team,
        coach_id: coachInfo?.coach_id,
        coach: coachInfo?.coach,
        activities: activityInfo
          ? {
              name: activityInfo.name,
              seasons: activityInfo.season_id ? { name: seasonMap.get(activityInfo.season_id) || '' } : null
            }
          : null
      }
    })

    setTeams(teamsWithRelations)
    setLoading(false)
  }

  const loadActivities = async () => {
    const { data: activitiesData } = await supabase
      .from('activities')
      .select('*')
      .order('name')

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
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('role', 'coach')
      .order('first_name')

    setCoaches(data || [])
  }

  const generateTeamCode = (teamName: string, activityName: string): string => {
    const teamInitials = teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
    
    const activityInitial = activityName.charAt(0).toUpperCase()
    const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0')
    
    return `${teamInitials}${activityInitial}${randomNum}`
  }

  const handleCreateTeam = async (teamData: Omit<Team, 'id'>) => {
    const { coach_id, ...teamPayload } = teamData

    const { data, error } = await supabase
      .from('teams')
      .insert([teamPayload])
      .select('id')
      .single()

    if (error || !data) {
      return
    }

    if (coach_id) {
      await supabase.from('team_coaches').insert({
        team_id: data.id,
        coach_id,
        role: 'head_coach',
        assigned_at: new Date().toISOString().slice(0, 10)
      })
    }

    setShowModal(false)
    setEditingTeam(null)
    loadTeams()
  }

  const handleUpdateTeam = async (id: string, teamData: Partial<Team>) => {
    const { coach_id, ...teamPayload } = teamData

    if (Object.keys(teamPayload).length > 0) {
      await supabase
        .from('teams')
        .update(teamPayload)
        .eq('id', id)
    }

    await supabase.from('team_coaches').delete().eq('team_id', id)

    if (coach_id) {
      await supabase.from('team_coaches').insert({
        team_id: id,
        coach_id,
        role: 'head_coach',
        assigned_at: new Date().toISOString().slice(0, 10)
      })
    }

    setShowModal(false)
    setEditingTeam(null)
    loadTeams()
  }

  const handleDeleteTeam = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa squadra? Verranno eliminati anche tutti i membri collegati.')) {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', id)

      if (!error) {
        loadTeams()
      }
    }
  }

  if (loading) {
    return <div className="p-4">Caricamento squadre...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Squadre</h2>
        <div className="flex gap-3">
          <button
            onClick={() => exportTeams(teams)}
            className="cs-btn cs-btn--outline"
          >
            <span className="mr-2">📊</span>
            Export Excel
          </button>
          <button
            onClick={() => {
              setEditingTeam(null)
              setShowModal(true)
            }}
            className="cs-btn cs-btn--primary"
          >
            Nuova Squadra
          </button>
        </div>
      </div>

      <TeamModal
  open={showModal}
  onClose={() => { setShowModal(false); setEditingTeam(null) }}
  team={editingTeam}
  activities={activities}
  coaches={coaches}
  onCreate={handleCreateTeam}
  onUpdate={handleUpdateTeam}
  onGenerateCode={generateTeamCode}
/>

      <div className="cs-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Squadra</th>
              <th>Codice</th>
              <th>Attività</th>
              <th>Allenatore</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id}>
                <td className="flex items-center">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">👥</div>
                    <div>
                      <div className="text-sm font-medium ">{team.name}</div>
                      <div className="text-xs text-gray-500">
                        {team.activities?.seasons?.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {team.code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{team.activities?.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium">
                    {team.coach ? 
                      `${team.coach.first_name} ${team.coach.last_name}` : 
                      <span className="text-gray-400">Nessun allenatore</span>
                    }
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingTeam(team)
                      setShowModal(true)
                    }}
                    className="cs-btn cs-btn--outline cs-btn--sm"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(team.id!)}
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
          {teams.map((team) => (
            <div key={team.id} className="cs-card">
              <div className="font-semibold">{team.name}</div>
              <div className="mt-1"><span className="cs-badge cs-badge--neutral">{team.code}</span></div>
              <div className="mt-2 grid gap-2 text-sm">
                <div><strong>Attività:</strong> {team.activities?.name || '-'}</div>
                <div><strong>Stagione:</strong> {team.activities?.seasons?.name || '-'}</div>
                <div>
                  <strong>Allenatore:</strong> {team.coach ? `${team.coach.first_name} ${team.coach.last_name}` : 'Nessun allenatore'}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setEditingTeam(team); setShowModal(true) }}
                  className="cs-btn cs-btn--outline cs-btn--sm flex-1"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDeleteTeam(team.id!)}
                  className="cs-btn cs-btn--danger cs-btn--sm flex-1"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        {teams.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="text-gray-500 mb-4">
              <span className="text-4xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessuna squadra creata
            </h3>
            <p className="text-gray-600 mb-4">
              Crea la tua prima squadra per iniziare a organizzare gli atleti in gruppi di lavoro.
            </p>
            <button
              onClick={() => {
                setEditingTeam(null)
                setShowModal(true)
              }}
              className="cs-btn cs-btn--primary"
            >
              Crea la tua prima squadra
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamForm({ 
  team, 
  activities,
  coaches,
  onSubmit, 
  onCancel,
  onGenerateCode
}: { 
  team: Team | null
  activities: Activity[]
  coaches: Coach[]
  onSubmit: (data: Omit<Team, 'id'>) => void
  onCancel: () => void
  onGenerateCode: (teamName: string, activityName: string) => string
}) {
  const [formData, setFormData] = useState({
    name: team?.name || '',
    code: team?.code || '',
    activity_id: team?.activity_id || '',
    coach_id: team?.coach_id || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      coach_id: formData.coach_id || undefined
    })
  }

  const handleGenerateCode = () => {
    if (formData.name && formData.activity_id) {
      const selectedActivity = activities.find(a => a.id === formData.activity_id)
      if (selectedActivity) {
        const newCode = onGenerateCode(formData.name, selectedActivity.name)
        setFormData({ ...formData, code: newCode })
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">
        {team ? 'Modifica Squadra' : 'Nuova Squadra'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome Squadra *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Es: Under 15, Primi Calci, Squadra A..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attività *
          </label>
          <select
            required
            value={formData.activity_id}
            onChange={(e) => setFormData({ ...formData, activity_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleziona un'attività</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name} ({activity.seasons?.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Codice Squadra *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es: U15C001"
              maxLength={10}
            />
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={!formData.name || !formData.activity_id}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Genera
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Il codice deve essere univoco. Usa "Genera" per creare automaticamente un codice basato su nome e attività.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Allenatore
          </label>
          <select
            value={formData.coach_id}
            onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nessun allenatore assegnato</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.first_name} {coach.last_name} ({coach.email})
              </option>
            ))}
          </select>
          {coaches.length === 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Nessun allenatore disponibile. Crea prima degli utenti con ruolo "Allenatore".
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {team ? 'Aggiorna' : 'Crea'} Squadra
          </button>
        </div>
      </form>
    </div>
  )
}
