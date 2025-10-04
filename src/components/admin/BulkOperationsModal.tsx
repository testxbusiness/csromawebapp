'use client'

import { useState } from 'react'
import AdminModal from './AdminModal'

interface BulkOperationsModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (operation: string, parameters: Record<string, unknown>) => void
  onTeamAssignmentRequest?: () => void
  selectedCount: number
  userType: 'athletes' | 'coaches'
  loading?: boolean
  selectedUsers?: Array<{
    id: string
    teams?: Array<{
      id: string
      name: string
    }>
  }>
}

export default function BulkOperationsModal({
  isOpen,
  onClose,
  onConfirm,
  onTeamAssignmentRequest,
  selectedCount,
  userType,
  loading = false,
  selectedUsers = []
}: BulkOperationsModalProps) {
  const [selectedOperation, setSelectedOperation] = useState<string>('')
  const [parameters, setParameters] = useState<Record<string, unknown>>({})

  const operations = userType === 'athletes' ? [
    { value: 'assign_to_team', label: 'Assegna a Squadra' },
    { value: 'remove_from_team', label: 'Rimuovi da Squadra' },
    { value: 'update_jersey', label: 'Aggiorna Numero Maglia' },
    { value: 'update_medical_expiry', label: 'Aggiorna Scadenza Certificato' }
  ] : [
    { value: 'assign_to_team', label: 'Assegna a Squadra' },
    { value: 'remove_from_team', label: 'Rimuovi da Squadra' },
    { value: 'update_staff_role', label: 'Aggiorna Ruolo Staff' }
  ]

  const handleParameterChange = (key: string, value: string) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleOperationSelect = (operation: string) => {
    setSelectedOperation(operation)

    // Se l'operazione è "assign_to_team" e c'è il callback, apri direttamente il modal di assegnazione squadra
    if (operation === 'assign_to_team' && onTeamAssignmentRequest) {
      onTeamAssignmentRequest()
      setSelectedOperation('')
      setParameters({})
      return
    }
  }

  const handleConfirm = () => {
    if (!selectedOperation) return
    onConfirm(selectedOperation, parameters)
    // Reset form after confirmation
    setSelectedOperation('')
    setParameters({})
  }

  const renderOperationForm = () => {
    switch (selectedOperation) {
      case 'assign_to_team':
        // Questa operazione apre direttamente il TeamAssignmentModal, quindi non mostra form
        return (
          <div className="cs-alert cs-alert--neutral text-sm">
            <strong>Assegnazione Squadra:</strong> Verrà aperto un modal dedicato per selezionare la squadra e il piano di pagamento.
          </div>
        )

      case 'remove_from_team':
        // Trova tutte le squadre uniche tra gli utenti selezionati
        const allTeams = selectedUsers.flatMap(user => user.teams || [])
        const uniqueTeams = Array.from(new Map(allTeams.map(team => [team.id, team])).values())

        // Per i coach, permette selezione multipla; per gli atleti, selezione singola
        const isMultiSelect = userType === 'coaches'
        const selectedTeamIds = parameters.teamIds || []

        return (
          <div>
            {uniqueTeams.length > 0 ? (
              <>
                <label className="cs-field__label">
                  {isMultiSelect ? 'Seleziona Squadre da cui Rimuovere' : 'Seleziona Squadra da cui Rimuovere'}
                </label>

                {isMultiSelect ? (
                  // Selezione multipla per coach
                  <div className="max-h-60 overflow-y-auto cs-card p-2">
                    {uniqueTeams.map(team => (
                      <label key={team.id} className="flex items-center space-x-3 p-2 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(team.id)}
                          onChange={(e) => {
                            const newTeamIds = e.target.checked
                              ? [...selectedTeamIds, team.id]
                              : selectedTeamIds.filter(id => id !== team.id)
                            handleParameterChange('teamIds', newTeamIds)
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{team.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  // Selezione singola per atleti
                  <select
                    value={parameters.teamId || ''}
                    onChange={(e) => handleParameterChange('teamId', e.target.value)}
                    className="cs-select"
                  >
                    <option value="">Seleziona una squadra</option>
                    {uniqueTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                )}

                {((isMultiSelect && selectedTeamIds.length > 0) || (!isMultiSelect && parameters.teamId)) && (
                  <div className="mt-4 cs-alert cs-alert--warning text-sm">
                    <p>
                      <strong>Attenzione:</strong> Verranno rimossi {selectedCount} {userType === 'athletes' ? 'atleti' : 'collaboratori'} da
                      {isMultiSelect ? (
                        <>
                          {' '}{selectedTeamIds.length} squadr{selectedTeamIds.length === 1 ? 'a' : 'e'}:
                          {uniqueTeams
                            .filter(t => selectedTeamIds.includes(t.id))
                            .map(t => t.name)
                            .join(', ')}
                        </>
                      ) : (
                        <> la squadra &quot;{uniqueTeams.find(t => t.id === parameters.teamId)?.name}&quot;</>
                      )}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="cs-alert cs-alert--danger text-sm">
                <p>
                  <strong>Errore:</strong> Nessuna squadra trovata per gli utenti selezionati.
                  Gli utenti devono essere assegnati ad almeno una squadra per poter essere rimossi.
                </p>
              </div>
            )}
          </div>
        )

      case 'update_jersey':
        // Trova tutte le squadre uniche tra gli utenti selezionati
        const jerseyTeams = selectedUsers.flatMap(user => user.teams || [])
        const uniqueJerseyTeams = Array.from(new Map(jerseyTeams.map(team => [team.id, team])).values())

        return (
          <div className="space-y-4">
            <div>
              <label className="cs-field__label">Seleziona Squadra</label>
              <select
                value={parameters.teamId || ''}
                onChange={(e) => handleParameterChange('teamId', e.target.value)}
                className="cs-select"
              >
                <option value="">Seleziona una squadra</option>
                {uniqueJerseyTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="cs-field__label">Nuovo Numero Maglia</label>
              <input
                type="text"
                value={parameters.jerseyNumber || ''}
                onChange={(e) => handleParameterChange('jerseyNumber', e.target.value)}
                className="cs-input"
                placeholder="Numero maglia"
              />
            </div>
            {parameters.teamId && (
              <div className="cs-alert cs-alert--neutral text-sm">
                <p>
                  Verrà aggiornato il numero maglia per {selectedCount} atlet{selectedCount > 1 ? 'i' : 'o'} nella squadra &quot;{uniqueJerseyTeams.find(t => t.id === parameters.teamId)?.name}&quot;
                </p>
              </div>
            )}
          </div>
        )

      case 'update_medical_expiry':
        return (
          <div>
            <label className="cs-field__label">Nuova Data Scadenza (YYYY-MM-DD)</label>
            <input
              type="date"
              value={parameters.expiryDate || ''}
              onChange={(e) => handleParameterChange('expiryDate', e.target.value)}
              className="cs-input"
            />
          </div>
        )

      case 'update_staff_role':
        return (
          <div>
            <label className="cs-field__label">Nuovo Ruolo</label>
            <select
              value={parameters.role || 'assistant_coach'}
              onChange={(e) => handleParameterChange('role', e.target.value)}
              className="cs-select"
            >
              <option value="assistant_coach">Allenatore Assistente</option>
              <option value="head_coach">Allenatore Capo</option>
            </select>
          </div>
        )

      default:
        return (
          <p className="text-secondary">
            Seleziona un&apos;operazione per visualizzare i parametri richiesti.
          </p>
        )
    }
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className="cs-btn cs-btn--ghost" disabled={loading}>
        Annulla
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedOperation || loading}
        className="cs-btn cs-btn--primary"
      >
        {loading ? 'Caricamento...' : 'Conferma Operazione'}
      </button>
    </div>
  )

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Operazione Massiva - ${selectedCount} ${userType === 'athletes' ? 'atleti' : 'collaboratori'} selezionati`}
      footer={footer}
      sizeClassName="max-w-md"
    >
      <div className="space-y-6">
        <div>
          <label className="cs-field__label">Tipo di Operazione</label>
          <select
            value={selectedOperation}
            onChange={(e) => handleOperationSelect(e.target.value)}
            className="cs-select"
          >
            <option value="">Seleziona un&apos;operazione...</option>
            {operations.map(op => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {selectedOperation && (
          <div>
            <h4 className="text-sm font-medium mb-3">Parametri Operazione</h4>
            {renderOperationForm()}
          </div>
        )}

        <div className="cs-alert cs-alert--warning text-sm">
          <strong>Attenzione:</strong> Questa operazione verrà applicata a tutti i {selectedCount} {userType === 'athletes' ? 'atleti' : 'collaboratori'} selezionati.
        </div>
      </div>
    </AdminModal>
  )
}
