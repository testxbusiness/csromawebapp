'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportSeasons } from '@/lib/utils/excelExport'
import { SeasonsModal } from './SeasonsModal'
import { Button } from '@/components/ui/Button'

interface Season {
  id?: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export default function SeasonsManager() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadSeasons()
  }, [])

  const loadSeasons = async () => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })

    setSeasons(data || [])
    setLoading(false)
  }

  const handleCreateSeason = async (seasonData: Omit<Season, 'id'>) => {
    const { error } = await supabase
      .from('seasons')
      .insert([seasonData])

    if (!error) {
      setModalOpen(false)
      setEditingSeason(null)
      loadSeasons()
    }
  }

  const handleUpdateSeason = async (id: string, seasonData: Partial<Season>) => {
    const { error } = await supabase
      .from('seasons')
      .update(seasonData)
      .eq('id', id)

    if (!error) {
      setModalOpen(false)
      setEditingSeason(null)
      loadSeasons()
    }
  }

  const handleDeleteSeason = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa stagione?')) {
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', id)

      if (!error) {
        loadSeasons()
      }
    }
  }

  const handleSetActiveSeason = async (id: string) => {
    // First deactivate all seasons
    await supabase
      .from('seasons')
      .update({ is_active: false })
      .neq('id', id)

    // Then activate the selected season
    const { error } = await supabase
      .from('seasons')
      .update({ is_active: true })
      .eq('id', id)

    if (!error) {
      loadSeasons()
    }
  }

  if (loading) {
    return <div className="p-4">Caricamento stagioni...</div>
  }

  const handleSubmit = (data: Omit<Season, 'id'>) => {
    if (editingSeason?.id) {
      handleUpdateSeason(editingSeason.id, data)
    } else {
      handleCreateSeason(data as Season)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Stagioni Sportive</h2>
        <div className="flex gap-3">
          <Button
            onClick={() => exportSeasons(seasons)}
            variant="outline"
          >
            📊 Export Excel
          </Button>
          <Button
            onClick={() => {
              setEditingSeason(null)
              setModalOpen(true)
            }}
          >
            Nuova Stagione
          </Button>
        </div>
      </div>

      <SeasonsModal
        season={editingSeason}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
      />

      <div className="cs-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block">
        <table className="cs-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Periodo</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.id}>
                <td>
                  <div className="font-medium">{season.name}</div>
                </td>
                <td>
                  <div>
                    {new Date(season.start_date).toLocaleDateString('it-IT')} - 
                    {new Date(season.end_date).toLocaleDateString('it-IT')}
                  </div>
                </td>
                <td>
                  {season.is_active ? (
                    <span className="cs-badge cs-badge--success">Attiva</span>
                  ) : (
                    <span className="cs-badge cs-badge--neutral">Inattiva</span>
                  )}
                </td>
                <td className="cs-table__actions">
                  {!season.is_active && (
                    <button onClick={() => handleSetActiveSeason(season.id!)} className="cs-btn cs-btn--primary cs-btn--sm">
                      Attiva
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingSeason(season); setModalOpen(true) }}
                    className="cs-btn cs-btn--outline cs-btn--sm"
                  >
                    Modifica
                  </button>
                  <button onClick={() => handleDeleteSeason(season.id!)} className="cs-btn cs-btn--danger cs-btn--sm">
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
          {seasons.map((season) => (
            <div key={season.id} className="cs-card">
              <div className="font-semibold">{season.name}</div>
              <div className="text-sm text-secondary">
                {new Date(season.start_date).toLocaleDateString('it-IT')} - {new Date(season.end_date).toLocaleDateString('it-IT')}
              </div>
              <div className="mt-2">
                <span className={`cs-badge ${season.is_active ? 'cs-badge--success' : 'cs-badge--neutral'}`}>{season.is_active ? 'Attiva' : 'Inattiva'}</span>
              </div>
              <div className="mt-3 flex gap-2">
                {!season.is_active && (
                  <button onClick={() => handleSetActiveSeason(season.id!)} className="cs-btn cs-btn--primary cs-btn--sm flex-1">Attiva</button>
                )}
                <button onClick={() => { setEditingSeason(season); setModalOpen(true) }} className="cs-btn cs-btn--outline cs-btn--sm flex-1">Modifica</button>
                <button onClick={() => handleDeleteSeason(season.id!)} className="cs-btn cs-btn--danger cs-btn--sm flex-1">Elimina</button>
              </div>
            </div>
          ))}
        </div>
        {seasons.length === 0 && (
          <div className="text-center text-secondary py-6">Nessuna stagione creata</div>
        )}
      </div>
    </div>
  )
}
