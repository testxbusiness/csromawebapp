'use client'

import { Trophy, Users } from 'lucide-react'
import { Badge, Card, CardMeta, CardTitle, Select } from '@/components/ui'
import type { Championship, ChampionshipGroup } from '@/components/championship/types'

type AthleteChampionshipShellProps = {
  teamLabel: string
  championships: Championship[]
  selectedChampionship: Championship | null
  selectedChampionshipId: string | null
  onChampionshipChange: (championshipId: string | null) => void
  groups: ChampionshipGroup[]
  selectedGroupId: string | null
  onGroupChange: (groupId: string | null) => void
  onGroupSelected: (groupId: string | null) => void
}

export function AthleteChampionshipShell({
  teamLabel,
  championships,
  selectedChampionship,
  selectedChampionshipId,
  onChampionshipChange,
  groups,
  selectedGroupId,
  onGroupChange,
  onGroupSelected,
}: AthleteChampionshipShellProps) {
  const showChampionshipSelector = championships.length > 1
  const showGroupSelector = groups.length > 1

  return (
    <Card variant="primary" className="overflow-hidden border-[color:var(--cs-brand-red)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--cs-primary)]">Area atleta</p>
            <CardTitle className="mt-1 text-2xl sm:text-3xl">Campionato</CardTitle>
            <CardMeta>Segui la prossima gara, la convocazione e il rendimento del girone.</CardMeta>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Contesto campionato">
            <Badge variant="neutral" className="min-h-10 gap-2 px-3 font-semibold">
              <Trophy className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              {selectedChampionship?.name ?? 'Seleziona un campionato'}
            </Badge>
            <Badge variant="neutral" className="min-h-10 gap-2 px-3 font-semibold">
              <Users className="h-4 w-4 text-[color:var(--cs-accent)]" aria-hidden="true" />
              {teamLabel}
            </Badge>
            <span className="sr-only">{championships.length === 1 ? '1 campionato disponibile' : `${championships.length} campionati disponibili`}</span>
          </div>
        </div>

        {showChampionshipSelector || showGroupSelector ? (
          <div className="grid gap-3 border-t border-[color:var(--cs-border-subtle)] pt-4 md:grid-cols-2">
            {showChampionshipSelector ? (
              <div className="space-y-2">
                <label htmlFor="athlete-championship-select" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--cs-text-secondary)]">Seleziona un campionato</label>
                <Select id="athlete-championship-select" value={selectedChampionshipId || ''} onChange={(event) => onChampionshipChange(event.target.value || null)}>
                  <option value="">Seleziona un campionato</option>
                  {championships.map((championship) => <option key={championship.id} value={championship.id}>{championship.name} · {championship.sport}</option>)}
                </Select>
              </div>
            ) : null}
            {showGroupSelector ? (
              <div className="space-y-2">
                <label htmlFor="athlete-group-select" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--cs-text-secondary)]">Seleziona un girone</label>
                <Select id="athlete-group-select" value={selectedGroupId || ''} onChange={(event) => { const groupId = event.target.value || null; onGroupChange(groupId); onGroupSelected(groupId) }}>
                  <option value="">Seleziona un girone</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.phase}</option>)}
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

      </div>
    </Card>
  )
}
