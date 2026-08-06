'use client'

import { Button, Input, Modal, Select } from '@/components/ui'
import type { ClubTeamOption, Team } from '@/components/championship/types'

export type GroupTeamsSelection = Record<string, { selected: boolean; is_home_club: boolean }>
export type NewClubTeam = { code: string; name: string; is_home_club: boolean; team_id: string }

interface ChampionshipGroupTeamsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clubTeams: ClubTeamOption[]
  teams: Team[]
  selection: GroupTeamsSelection
  onSelectionChange: (selection: GroupTeamsSelection) => void
  search: string
  onSearchChange: (search: string) => void
  newClubTeam: NewClubTeam
  onNewClubTeamChange: (value: NewClubTeam) => void
  saving: boolean
  onAddClubTeam: () => void | Promise<void>
  onSave: () => void | Promise<void>
}

export function ChampionshipGroupTeamsModal({
  open,
  onOpenChange,
  clubTeams,
  teams,
  selection,
  onSelectionChange,
  search,
  onSearchChange,
  newClubTeam,
  onNewClubTeamChange,
  saving,
  onAddClubTeam,
  onSave,
}: ChampionshipGroupTeamsModalProps) {
  const term = search.toLowerCase()
  const updateNewClubTeam = (value: Partial<NewClubTeam>) => onNewClubTeamChange({ ...newClubTeam, ...value })

  return (
    <Modal fullscreenOnMobile open={open} onOpenChange={onOpenChange} title="Squadre del girone" description="Seleziona le squadre che partecipano al girone e indica quelle CSRoma." size="lg">
      <div className="space-y-3">
        <div>
          <label className="cs-label">Filtra squadre</label>
          <Input placeholder="Cerca per nome o codice" value={search} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
        <div className="max-h-72 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
          {clubTeams
            .filter((team) => !term || team.name.toLowerCase().includes(term) || (team.code || '').toLowerCase().includes(term))
            .map((team) => {
              const state = selection[team.id] || { selected: false, is_home_club: team.is_home_club }
              return (
                <div key={team.id} className="flex items-center justify-between px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.selected}
                      onChange={(e) => onSelectionChange({ ...selection, [team.id]: { selected: e.target.checked, is_home_club: e.target.checked ? state.is_home_club : false } })}
                    />
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-xs text-slate-500">{team.code || 'Nessun codice'}</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-emerald-700">
                    <input
                      type="checkbox"
                      checked={state.is_home_club}
                      disabled={!state.selected}
                      onChange={(e) => onSelectionChange({ ...selection, [team.id]: { selected: true, is_home_club: e.target.checked } })}
                    />
                    CSRoma
                  </label>
                </div>
              )
            })}
        </div>
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="font-medium">Aggiungi nuova squadra campionato</div>
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="Codice" value={newClubTeam.code} onChange={(e) => updateNewClubTeam({ code: e.target.value })} />
            <Input placeholder="Nome" value={newClubTeam.name} onChange={(e) => updateNewClubTeam({ name: e.target.value })} />
            <Select value={newClubTeam.team_id} onChange={(e) => updateNewClubTeam({ team_id: e.target.value })}>
              <option value="">Avversario (nessun link)</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` (${team.code})` : ''}</option>)}
            </Select>
            <label className="flex items-center gap-2 text-sm text-emerald-700">
              <input type="checkbox" checked={newClubTeam.is_home_club} onChange={(e) => updateNewClubTeam({ is_home_club: e.target.checked })} />
              CSRoma
            </label>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={onAddClubTeam}>Aggiungi squadra</Button></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? 'Salvataggio...' : 'Salva squadre'}</Button>
        </div>
      </div>
    </Modal>
  )
}
