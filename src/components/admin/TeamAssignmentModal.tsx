'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  code: string
  activity_id?: string
}

interface MembershipFee {
  id: string
  name: string
  description?: string
  total_amount: number
  enrollment_fee: number
  insurance_fee: number
  monthly_fee: number
  months_count: number
  installments_count: number
  team_id: string
  team_name?: string
  team_code?: string
}

interface TeamAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    teamIds: string[]
    jerseyNumber?: string
    membershipFeeId?: string
  }) => void
  athleteIds: string[]
  loading?: boolean
  userType?: 'athletes' | 'coaches'
}

export default function TeamAssignmentModal({
  isOpen,
  onClose,
  onSubmit,
  athleteIds,
  loading = false,
  userType = 'athletes'
}: TeamAssignmentModalProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set())
  const [jerseyNumber, setJerseyNumber] = useState<string>('')
  const [membershipFees, setMembershipFees] = useState<MembershipFee[]>([])
  const [selectedMembershipFeeId, setSelectedMembershipFeeId] = useState<string>('')
  const [loadingFees, setLoadingFees] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadTeams()
    }
  }, [isOpen])

  useEffect(() => {
    // Per gli atleti, carica i piani di pagamento solo se è selezionata una squadra
    if (userType === 'athletes' && selectedTeamIds.size === 1) {
      const teamId = Array.from(selectedTeamIds)[0]
      loadMembershipFees(teamId)
    } else {
      setMembershipFees([])
      setSelectedMembershipFeeId('')
    }
  }, [selectedTeamIds, userType])

  const loadTeams = async () => {
    try {
      const { data } = await supabase
        .from('teams')
        .select('id, name, code, activity_id')
        .order('name')

      setTeams(data || [])
    } catch (error) {
      console.error('Errore caricamento squadre:', error)
    }
  }

  const loadMembershipFees = async (teamId: string) => {
    setLoadingFees(true)
    try {
      const response = await fetch(`/api/admin/membership-fees/available?team_id=${teamId}`)
      const result = await response.json()

      if (!response.ok) {
        console.error('Errore caricamento piani di pagamento:', result.error)
        setMembershipFees([])
        return
      }

      setMembershipFees(result.membership_fees || [])

      // Se c'è un solo piano disponibile, selezionalo automaticamente
      if (result.membership_fees?.length === 1) {
        setSelectedMembershipFeeId(result.membership_fees[0].id)
      }
    } catch (error) {
      console.error('Errore caricamento piani di pagamento:', error)
      setMembershipFees([])
    } finally {
      setLoadingFees(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedTeamIds.size === 0) {
      alert('Seleziona almeno una squadra')
      return
    }

    // Per gli atleti, se è selezionato un piano di pagamento, verifica che sia selezionata una sola squadra
    if (userType === 'athletes' && selectedMembershipFeeId && selectedTeamIds.size > 1) {
      alert('Per assegnare un piano di pagamento, seleziona una sola squadra')
      return
    }

    onSubmit({
      teamIds: Array.from(selectedTeamIds),
      jerseyNumber: jerseyNumber || undefined,
      membershipFeeId: selectedMembershipFeeId || undefined
    })
  }

  const handleClose = () => {
    setSelectedTeamIds(new Set())
    setJerseyNumber('')
    setSelectedMembershipFeeId('')
    setMembershipFees([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 cs-overlay" aria-hidden="false">
      <div className="cs-modal cs-modal--sm" data-state="open">
        <button className="cs-modal__close" onClick={handleClose} aria-label="Chiudi">✕</button>
        <div className="">
          <h2 className="cs-modal__title mb-2">
            Assegna {athleteIds.length} {userType === 'athletes' ? 'atlet' : 'collaborator'}{athleteIds.length > 1 ? 'i' : 'o'} {userType === 'coaches' ? 'alle squadre' : 'alla squadra'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selezione Squadra */}
            <div>
              <label className="cs-field__label">
                {userType === 'coaches' ? 'Seleziona una o più squadre *' : 'Squadra *'}
              </label>
              <div className="max-h-60 overflow-y-auto cs-card p-2">
                {teams.map(team => (
                  <label key={team.id} className="flex items-center space-x-3 p-2 cursor-pointer">
                    <input
                      type={userType === 'coaches' ? 'checkbox' : 'radio'}
                      checked={selectedTeamIds.has(team.id)}
                      onChange={(e) => {
                        const newSelectedTeamIds = new Set(selectedTeamIds)
                        if (e.target.checked) {
                          if (userType === 'athletes') {
                            // Per gli atleti, permette solo una selezione
                            newSelectedTeamIds.clear()
                          }
                          newSelectedTeamIds.add(team.id)
                        } else {
                          newSelectedTeamIds.delete(team.id)
                        }
                        setSelectedTeamIds(newSelectedTeamIds)
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      {team.name} ({team.code})
                    </span>
                  </label>
                ))}
              </div>
              {selectedTeamIds.size > 0 && (
                <div className="mt-2 text-xs text-secondary">
                  Selezionate: {selectedTeamIds.size} squadr{selectedTeamIds.size === 1 ? 'a' : 'e'}
                </div>
              )}
            </div>

            {/* Numero Maglia (opzionale) */}
            <div>
              <label className="cs-field__label">
                Numero Maglia (opzionale)
              </label>
              <input
                type="text"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                placeholder="Es: 10"
                className="cs-input"
              />
            </div>

            {/* Selezione Piano di Pagamento (solo per atleti) */}
            {selectedTeamIds.size > 0 && userType === 'athletes' && (
              <div>
                <label className="cs-field__label">
                  Piano di Pagamento (opzionale)
                </label>
                {selectedTeamIds.size > 1 ? (
                  <div className="cs-alert cs-alert--warning text-sm">
                    ⚠️ Per assegnare un piano di pagamento, seleziona una sola squadra
                  </div>
                ) : loadingFees ? (
                  <div className="text-sm text-secondary">Caricamento piani disponibili...</div>
                ) : membershipFees.length > 0 ? (
                  <select
                    value={selectedMembershipFeeId}
                    onChange={(e) => setSelectedMembershipFeeId(e.target.value)}
                    className="cs-select"
                  >
                    <option value="">Nessun piano di pagamento</option>
                    {membershipFees.map(fee => (
                      <option key={fee.id} value={fee.id}>
                        {fee.name} - €{fee.total_amount.toFixed(2)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-secondary">
                    Nessun piano di pagamento disponibile per questa squadra
                  </div>
                )}

                {/* Dettagli piano selezionato */}
                {selectedMembershipFeeId && (
                  <div className="mt-2 cs-card text-sm">
                    {(() => {
                      const selectedFee = membershipFees.find(f => f.id === selectedMembershipFeeId)
                      if (!selectedFee) return null

                      return (
                        <div>
                          <div className="font-medium">{selectedFee.name}</div>
                          <div className="text-secondary">
                            Iscrizione: €{selectedFee.enrollment_fee.toFixed(2)} •
                            Assicurazione: €{selectedFee.insurance_fee.toFixed(2)} •
                            Mensilità: €{selectedFee.monthly_fee.toFixed(2)} × {selectedFee.months_count} mesi
                          </div>
                          <div className="text-secondary">
                            {selectedFee.installments_count} rate • Totale: €{selectedFee.total_amount.toFixed(2)}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Assegnazione...' : 'Assegna'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
