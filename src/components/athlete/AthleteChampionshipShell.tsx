'use client'

import { Trophy, Users } from 'lucide-react'
import { Card, CardMeta, CardTitle, Select } from '@/components/ui'
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
    <Card variant="primary" className="overflow-hidden">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--cs-primary)]">Area atleta</p>
            <CardTitle className="mt-1 text-2xl sm:text-3xl">Campionato</CardTitle>
            <CardMeta>Segui la prossima gara, la convocazione e il rendimento del girone.</CardMeta>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-4 font-medium text-[color:var(--cs-text)]">
              <Trophy className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              {selectedChampionship?.name ?? 'Seleziona un campionato'}
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-4 font-medium text-[color:var(--cs-text)]">
              <Users className="h-4 w-4 text-[color:var(--cs-accent)]" aria-hidden="true" />
              {teamLabel}
            </div>
          </div>
        </div>

        {showChampionshipSelector || showGroupSelector ? (
          <div className="grid gap-3 border-t border-[color:var(--cs-border-subtle)] pt-4 md:grid-cols-2">
            {showChampionshipSelector ? (
              <div className="space-y-2">
                <label htmlFor="athlete-championship-select" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--cs-text-secondary)]">Campionato</label>
                <Select id="athlete-championship-select" value={selectedChampionshipId || ''} onChange={(event) => onChampionshipChange(event.target.value || null)}>
                  <option value="">Seleziona un campionato</option>
                  {championships.map((championship) => <option key={championship.id} value={championship.id}>{championship.name} · {championship.sport}</option>)}
                </Select>
              </div>
            ) : null}
            {showGroupSelector ? (
              <div className="space-y-2">
                <label htmlFor="athlete-group-select" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--cs-text-secondary)]">Girone</label>
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
