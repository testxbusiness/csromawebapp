'use client'

import { ReactNode } from 'react'
import { CalendarDays, Clock3, MapPin, ShieldCheck, Trophy, Users } from 'lucide-react'
import { Badge, Button, Card, CardMeta, CardTitle, Table } from '@/components/ui'

type InfoItem = {
  label: string
  value: string
}

type NextMatchCardProps = {
  matchDateLabel: string
  roundLabel: string
  matchupLabel: string
  locationLabel: string
  onOpenConvocations: () => void
  helperText?: string
  empty?: boolean
  emptyText?: string
}

export type StandingRow = {
  club_team_id: string
  team_name: string
  class_points: number
  matches_played: number
  wins: number
  losses: number
  sets_for: number
  sets_against: number
  points_for: number
  points_against: number
}

type ConvocationMemberView = {
  id: string
  label: string
  jerseyNumber?: string
  selected?: boolean
}

type EditableConvocationListProps = {
  members: ConvocationMemberView[]
  canEdit: boolean
  onToggle: (memberId: string, checked: boolean) => void
}

export function ChampionshipToolbar({
  championshipSelect,
  groupSelect,
  actions,
}: {
  championshipSelect: ReactNode
  groupSelect: ReactNode
  actions: ReactNode
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Campionato</label>
        {championshipSelect}
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Girone</label>
        {groupSelect}
      </div>
      <div className="lg:justify-self-end">
        <div className="flex flex-wrap justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>
  )
}

export function getStatusBadgeVariant(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'completed' || status === 'published') return 'success'
  if (status === 'postponed' || status === 'draft') return 'warning'
  if (status === 'cancelled' || status === 'forfeit' || status === 'archived') return 'danger'
  return 'neutral'
}

export function ChampionshipInfoPanel({
  title = 'Info campionato',
  description,
  items,
  emptyText,
}: {
  title?: string
  description?: string
  items: InfoItem[] | null
  emptyText: string
}) {
  return (
    <Card variant="primary">
      <CardTitle>{title}</CardTitle>
      {description ? <CardMeta>{description}</CardMeta> : null}
      <div className="mt-4">
        {items && items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </Card>
  )
}

export function NextMatchPanel({
  matchDateLabel,
  roundLabel,
  matchupLabel,
  locationLabel,
  onOpenConvocations,
  helperText = 'Apri la convocazione per vedere subito chi è stato inserito per la gara.',
  empty = false,
  emptyText = 'Nessuna prossima partita CSRoma disponibile.',
}: NextMatchCardProps) {
  return (
    <Card variant="primary" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Prossima partita CSRoma</CardTitle>
          <CardMeta>Accesso rapido a convocazioni e dati operativi della prossima gara.</CardMeta>
        </div>
        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[color:var(--cs-primary)] shadow-sm sm:flex">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {empty ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="mt-5 space-y-4 text-sm text-slate-600">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-slate-800 shadow-sm">
              <Clock3 className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              {matchDateLabel}
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-slate-800 shadow-sm">
              <Trophy className="h-4 w-4 text-[color:var(--cs-accent)]" aria-hidden="true" />
              {roundLabel}
            </div>
          </div>
          <div className="text-lg font-semibold text-slate-950 sm:text-xl">{matchupLabel}</div>
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 text-sm text-slate-700">
            <MapPin className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
            {locationLabel}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="min-h-11 sm:min-w-52" onClick={onOpenConvocations}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Convocazioni
            </Button>
            <div className="text-sm text-slate-600">{helperText}</div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function StandingsPanel({
  rows,
  emptyText = 'Nessun dato',
  highlightTopThree = false,
}: {
  rows: StandingRow[]
  emptyText?: string
  highlightTopThree?: boolean
}) {
  return (
    <Card variant="primary" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Classifica</CardTitle>
          <CardMeta>La lettura deve restare veloce sia su desktop sia su mobile.</CardMeta>
        </div>
        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-center text-white shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Squadre</div>
          <div className="text-lg font-bold leading-none">{rows.length}</div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto hidden md:block">
        <Table compact>
          <thead>
            <tr>
              <th>#</th>
              <th>Squadra</th>
              <th>Pts</th>
              <th>G</th>
              <th>V</th>
              <th>P</th>
              <th>Set</th>
              <th>Punti</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400">{emptyText}</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.club_team_id} className={highlightTopThree && index < 3 ? 'bg-amber-50' : undefined}>
                <td className="font-semibold text-slate-500">{index + 1}</td>
                <td className="font-semibold">{row.team_name}</td>
                <td>{row.class_points}</td>
                <td>{row.matches_played}</td>
                <td>{row.wins}</td>
                <td>{row.losses}</td>
                <td>{row.sets_for}-{row.sets_against}</td>
                <td>{row.points_for}-{row.points_against}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            {emptyText}
          </div>
        )}
        {rows.map((row, index) => (
          <div key={row.club_team_id} className={`rounded-2xl border p-4 shadow-sm ${highlightTopThree && index < 3 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">#{index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{row.team_name}</div>
              </div>
              <div className="rounded-xl bg-slate-900 px-3 py-2 text-center text-white">
                <div className="text-[11px] uppercase tracking-wide text-slate-300">Pts</div>
                <div className="text-lg font-bold leading-none">{row.class_points}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">G</div><div className="font-semibold text-slate-900">{row.matches_played}</div></div>
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">V</div><div className="font-semibold text-slate-900">{row.wins}</div></div>
              <div className="rounded-lg bg-white/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">P</div><div className="font-semibold text-slate-900">{row.losses}</div></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Set</div><div className="font-semibold text-slate-900">{row.sets_for}-{row.sets_against}</div></div>
              <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Punti</div><div className="font-semibold text-slate-900">{row.points_for}-{row.points_against}</div></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function MatchStatusBadge({ label, status }: { label: string; status: string }) {
  return <Badge variant={getStatusBadgeVariant(status)}>{label}</Badge>
}

export function CalendarSyncBadge({ synced }: { synced: boolean }) {
  return (
    <Badge variant={synced ? 'success' : 'neutral'}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {synced ? 'Sincronizzato' : 'Non sincronizzato'}
    </Badge>
  )
}

export function ConvocationPublishedList({ members, emptyText }: { members: ConvocationMemberView[]; emptyText: string }) {
  if (members.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{emptyText}</div>
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-medium text-slate-900">{member.label}</span>
          {member.jerseyNumber ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{member.jerseyNumber}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function EditableConvocationList({ members, canEdit, onToggle }: EditableConvocationListProps) {
  if (members.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">Nessun atleta disponibile per questa squadra</div>
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <label
          key={member.id}
          className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition ${member.selected ? 'border-[color:var(--cs-primary)] bg-red-50/40' : 'border-slate-200 bg-white'} ${canEdit ? 'cursor-pointer' : 'opacity-70'}`}
        >
          <span className="flex items-center gap-3">
            <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${member.selected ? 'border-[color:var(--cs-primary)] bg-[color:var(--cs-primary)]' : 'border-slate-300 bg-white'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={!!member.selected}
                onChange={(e) => onToggle(member.id, e.target.checked)}
                disabled={!canEdit}
              />
              {member.selected ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : null}
            </span>
            <span className="text-sm font-medium text-slate-900">{member.label}</span>
          </span>
          {member.jerseyNumber ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{member.jerseyNumber}</span>
          ) : null}
        </label>
      ))}
    </div>
  )
}
