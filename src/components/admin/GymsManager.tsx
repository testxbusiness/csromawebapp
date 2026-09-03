'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/utils/excelExport'
import GymModal from '@/components/admin/GymModal'
import { EmptyState, LoadingState } from '@/components/ui'
import { BarChart3 } from 'lucide-react'

interface Gym {
  id?: string
  name: string
  address: string
  city: string
  capacity?: number
  season_id: string
  is_active?: boolean
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

export default function GymsManager({ embedded = false }: { embedded?: boolean }) {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [editingGym, setEditingGym] = useState<Gym | null>(null)
  const [showModal, setShowModal] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadGyms = useCallback(async () => {
    const { data: gymsData } = await supabase
      .from('gyms')
      .select('*')
      .order('created_at', { ascending: false })

    if (gymsData) {
      // Get season names for each gym
      const gymsWithSeasons = await Promise.all(
        gymsData.map(async (gym) => {
          if (gym.season_id) {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('name')
              .eq('id', gym.season_id)
              .single()
            
            return {
              ...gym,
              seasons: seasonData ? { name: seasonData.name } : null
            }
          }
          return { ...gym, seasons: null }
        })
      )
      
      setGyms(gymsWithSeasons)
    } else {
      setGyms([])
    }
    setLoading(false)
  }, [supabase])

  const loadSeasons = useCallback(async () => {
    const { data } = await supabase
      .from('seasons')
      .select('id, name, is_active')
      .order('start_date', { ascending: false })

    setSeasons(data || [])
  }, [supabase])

  useEffect(() => {
    void loadGyms()
    void loadSeasons()
  }, [loadGyms, loadSeasons])

  const handleCreateGym = async (gymData: Omit<Gym, 'id'>) => {
    const { error } = await supabase
      .from('gyms')
      .insert(gymData)

    if (!error) {
      setShowModal(false)
      setEditingGym(null)
      loadGyms()
    } else {
      console.error('Error creating gym:', error)
    }
  }

  const handleUpdateGym = async (id: string, gymData: Partial<Gym>) => {
    const { error } = await supabase
      .from('gyms')
      .update(gymData)
      .eq('id', id)

    if (!error) {
      setShowModal(false)
      setEditingGym(null)
      loadGyms()
    }
  }

  const handleDeleteGym = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa palestra?')) {
      const { error } = await supabase
        .from('gyms')
        .delete()
        .eq('id', id)

      if (!error) {
        loadGyms()
      }
    }
  }

  const exportGymsToExcel = () => {
    exportToExcel(gyms, [
      { key: 'name', title: 'Nome Palestra', width: 20 },
      { key: 'address', title: 'Indirizzo', width: 25 },
      { key: 'city', title: 'Città', width: 15 },
      { key: 'capacity', title: 'Capacità', width: 10 },
      { key: 'is_active', title: 'Attiva', width: 10, format: (val) => val ? 'Sì' : 'No' },
      { key: 'seasons', title: 'Stagione', width: 15, format: (val) => val?.name || '' },
      { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
    ], {
      filename: 'palestre_csroma',
      sheetName: 'Palestre',
      headerStyle: { fill: { fgColor: { rgb: 'FF6B6B' } } }
    })
  }

  if (loading) {
    return <LoadingState label="Caricamento palestre..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        {!embedded && <h2 className="text-2xl font-bold">Palestre</h2>}
        <div className="flex gap-3">
          <button onClick={exportGymsToExcel} className="cs-btn cs-btn--outline">
            <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
            Export Excel
          </button>
          <button
            onClick={() => {
              setEditingGym(null)
              setShowModal(true)
            }}
            className="cs-btn cs-btn--primary"
          >
            Nuova Palestra
          </button>
        </div>
      </div>

      <GymModal
  open={showModal}
  onClose={() => { setShowModal(false); setEditingGym(null) }}
  gym={editingGym}
  seasons={seasons}
  onCreate={handleCreateGym}
  onUpdate={handleUpdateGym}
  />

      <div className="cs-card cs-card--primary overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Indirizzo</th>
              <th>Capacità</th>
              <th>Stato</th>
              <th>Stagione</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {gyms.map((gym) => (
              <tr key={gym.id}>
                <td>
                  <div className="text-sm font-medium">{gym.name}</div>
                </td>
                <td>
                  <div className="text-sm">{gym.address}</div>
                  <div className="text-sm text-secondary">{gym.city}</div>
                </td>
                <td>
                  <div className="text-sm">{gym.capacity}</div>
                </td>
                <td>
                  <span className={`cs-badge ${gym.is_active ? 'cs-badge--success' : 'cs-badge--danger'}`}>
                    {gym.is_active ? 'Attiva' : 'Inattiva'}
                  </span>
                </td>
                <td>
                  <div className="text-sm">{gym.seasons?.name}</div>
                </td>
                <td className="text-sm font-medium">
                  <button
                    onClick={() => {
                      setEditingGym(gym)
                      setShowModal(true)
                    }}
                    className="cs-btn cs-btn--outline cs-btn--sm"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDeleteGym(gym.id!)}
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
          {gyms.map((gym) => (
            <div key={gym.id} className="cs-card">
              <div className="font-semibold">{gym.name}</div>
              <div className="text-sm text-secondary">{gym.address}</div>
              <div className="text-sm text-secondary">{gym.city}</div>
              <div className="mt-2 grid gap-2 text-sm">
                <div>
                  <strong>Capacità:</strong> {gym.capacity ?? '-'}
                </div>
                <div>
                  <strong>Stato:</strong> <span className={`cs-badge ${gym.is_active ? 'cs-badge--success' : 'cs-badge--danger'}`}>{gym.is_active ? 'Attiva' : 'Inattiva'}</span>
                </div>
                <div>
                  <strong>Stagione:</strong> {gym.seasons?.name || '-'}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => { setEditingGym(gym); setShowModal(true) }}
                  className="cs-btn cs-btn--outline cs-btn--sm flex-1"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDeleteGym(gym.id!)}
                  className="cs-btn cs-btn--danger cs-btn--sm flex-1"
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>

        {gyms.length === 0 && (
          <EmptyState
            title="Nessuna palestra creata"
            description="Crea la tua prima palestra per iniziare a gestire i luoghi dove si svolgono le attività."
            action={<button onClick={() => { setEditingGym(null); setShowModal(true) }} className="cs-btn cs-btn--primary">Crea la tua prima palestra</button>}
          />
        )}
      </div>
    </div>
  )
}
