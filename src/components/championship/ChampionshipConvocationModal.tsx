'use client'

import { Button, Select, Modal, StatusBadge } from '@/components/ui'
import { useEffect, useState } from 'react'
import { ConvocationPublishedList, EditableConvocationList } from '@/components/championship/ChampionshipPanels'
import type { ClubTeam, Convocation, ManagerMode, Match, TeamMember } from '@/components/championship/types'

type ConvocationClubTeam = { clubTeam: ClubTeam }

interface ChampionshipConvocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: Match | null
  clubTeamName: (clubTeamId: string) => string
  clubTeams: ConvocationClubTeam[]
  selectedClubTeamId: string | null
  onClubTeamChange: (clubTeamId: string | null, teamId: string | null) => void | Promise<void>
  selectedClubTeam: ClubTeam | null
  loading: boolean
  mode: ManagerMode
  convocation: Convocation | null
  teamMembers: TeamMember[]
  selection: Set<string>
  canEdit: boolean
  saving: boolean
  onToggle: (memberId: string, checked: boolean) => void
  onSave: () => void
}

export function ChampionshipConvocationModal({
  open,
  onOpenChange,
  match,
  clubTeamName,
  clubTeams,
  selectedClubTeamId,
  onClubTeamChange,
  selectedClubTeam,
  loading,
  mode,
  convocation,
  teamMembers,
  selection,
  canEdit,
  saving,
  onToggle,
  onSave,
}: ChampionshipConvocationModalProps) {
  const [confirmingRecipients, setConfirmingRecipients] = useState(false)
  useEffect(() => {
    setConfirmingRecipients(false)
  }, [match?.id, selectedClubTeamId, open])

  const existingMemberCount = convocation?.championship_match_convocation_members?.length ?? 0
  const actionLabel = saving
    ? 'Salvataggio…'
    : confirmingRecipients
      ? `Conferma ${selection.size} destinatari`
      : convocation?.id
        ? existingMemberCount > 0 ? 'Aggiorna convocazione' : 'Completa convocazione'
        : 'Prepara convocazione'
  return (
    <Modal
      fullscreenOnMobile
      open={open}
      onOpenChange={onOpenChange}
      title="Convocazioni"
      description={match ? `${clubTeamName(match.home_club_team_id)} vs ${clubTeamName(match.away_club_team_id)}` : ''}
    >
      {!match && <div className="text-sm text-slate-500">Seleziona una partita</div>}
      {match && (
        <div className="space-y-4">
          {clubTeams.length > 1 && (
            <div>
              <label className="cs-label">Squadra CSR da convocare</label>
              <Select
                value={selectedClubTeamId || ''}
                onChange={async (event) => {
                  const id = event.target.value || null
                  const chosen = clubTeams.find(({ clubTeam }) => clubTeam.id === id)?.clubTeam
                  await onClubTeamChange(id, chosen?.team_id || null)
                }}
              >
                {clubTeams.map(({ clubTeam }) => (
                  <option key={clubTeam.id} value={clubTeam.id}>{clubTeam.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="text-sm text-slate-600">
            {selectedClubTeam ? `Rosa: ${selectedClubTeam.name}` : 'Seleziona una squadra CSRoma'}
          </div>
          {mode !== 'athlete' && !loading && selectedClubTeam ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Destinatari finali</span>
                <StatusBadge status={selection.size > 0 ? 'info' : 'pending'} label={`${selection.size} atleti selezionati`} />
              </div>
              <p className="mt-1 text-xs text-slate-600">La convocazione sarà salvata per {selectedClubTeam.name}. Verifica la rosa prima di confermare.</p>
            </div>
          ) : null}
          {loading && <div className="text-sm text-slate-500">Caricamento convocazioni...</div>}

          {!loading && mode === 'athlete' && (
            <ConvocationPublishedList
              members={(convocation?.championship_match_convocation_members || []).map((member) => {
                const profile = member.profiles || member.team_members?.profiles
                const label = profile?.first_name || profile?.last_name
                  ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                  : 'Atleta'
                return {
                  id: member.team_member_id,
                  label,
                  jerseyNumber: member.team_members?.jersey_number ? `#${member.team_members.jersey_number}` : undefined,
                }
              })}
              emptyText="Le convocazioni non sono ancora state pubblicate"
            />
          )}

          {!loading && mode !== 'athlete' && (
            <EditableConvocationList
              members={teamMembers.map((member) => ({
                id: member.id,
                label: member.profiles ? `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() : member.id,
                jerseyNumber: member.jersey_number ? `#${member.jersey_number}` : undefined,
                selected: selection.has(member.id),
              }))}
              canEdit={canEdit}
              onToggle={onToggle}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Chiudi</Button>
            {mode !== 'athlete' && (
              <Button onClick={() => confirmingRecipients ? onSave() : setConfirmingRecipients(true)} disabled={!canEdit || saving || !selectedClubTeam}>
                {actionLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
