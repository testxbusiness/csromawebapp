'use client'

import { useTeamContext } from '@/context/TeamContext'

export function TeamSwitcher({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { teams, selectedTeamId, setSelectedTeamId } = useTeamContext()
  if (teams.length < 2) return null

  const id = `team-switcher-${variant}`
  return (
    <div className={variant === 'mobile' ? 'cs-team-switcher cs-team-switcher--mobile' : 'cs-team-switcher'} aria-label="Selettore squadra">
      <label htmlFor={id}>Squadra</label>
      <select id={id} className="cs-select min-h-11 max-w-full py-2 text-sm" value={selectedTeamId ?? ''} onChange={(event) => setSelectedTeamId(event.target.value || null)}>
        <option value="">Tutte le squadre</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` · ${team.code}` : ''}</option>)}
      </select>
    </div>
  )
}
