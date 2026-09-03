'use client'

import { ReactNode, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronUp, Clock3, MapPin, ShieldCheck, Trophy, Users } from 'lucide-react'
import { Badge, Button, Card, CardMeta, CardTitle, EmptyState, Table } from '@/components/ui'
import { formatChampionshipDate, formatMatchScore, formatMatchSetsDetail } from './formatters'
import { STATUS_LABEL, type Match } from './types'

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
  sideLabel?: string
  opponentLabel?: string
  convocationStatusLabel?: string
  meetingLabel?: string
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
  is_csr?: boolean
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
        <label className="cs-field__label">Campionato</label>
        {championshipSelect}
      </div>
      <div className="space-y-2">
        <label className="cs-field__label">Girone</label>
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
              <div key={item.label} className="cs-card cs-card--subdued px-4 py-3">
                <div className="cs-type-label">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--cs-ink)]">{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={emptyText} />
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
  sideLabel,
  opponentLabel,
  convocationStatusLabel = 'Convocazione da verificare',
  meetingLabel = 'Ritrovo non indicato',
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
        <div className="hidden h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--cs-surface-selected)] text-[color:var(--cs-primary)] sm:flex">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {empty ? (
        <EmptyState className="mt-5" title={emptyText} />
      ) : (
        <div className="mt-5 space-y-4 text-sm text-secondary">
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" className="inline-flex min-h-11 items-center gap-2 px-4 font-semibold">
              <Clock3 className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
              {matchDateLabel}
            </Badge>
            <Badge variant="neutral" className="inline-flex min-h-11 items-center gap-2 px-4 font-semibold">
              <Trophy className="h-4 w-4 text-[color:var(--cs-accent)]" aria-hidden="true" />
              {roundLabel}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sideLabel ? <Badge variant="neutral">{sideLabel}</Badge> : null}
            <span className="text-lg font-semibold text-[color:var(--cs-ink)] sm:text-xl">{matchupLabel}</span>
          </div>
          {opponentLabel ? <div className="text-sm text-secondary">Avversario: <span className="font-semibold text-[color:var(--cs-ink)]">{opponentLabel}</span></div> : null}
          <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-4 text-sm text-secondary">
            <MapPin className="h-4 w-4 text-[color:var(--cs-primary)]" aria-hidden="true" />
            {locationLabel}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="neutral" className="min-h-10 px-3">{convocationStatusLabel}</Badge>
            <Badge variant="neutral" className="min-h-10 px-3">{meetingLabel}</Badge>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="min-h-11 sm:min-w-52" onClick={onOpenConvocations}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Vedi convocazione
            </Button>
            <div className="text-sm text-secondary">{helperText}</div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function StandingsPanel({
  rows,
  emptyText = 'Nessun dato',
}: {
  rows: StandingRow[]
  emptyText?: string
}) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, 5)
  const hasOverflow = rows.length > 5

  return (
    <Card variant="primary" className="overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Classifica</CardTitle>
          <CardMeta>Prime cinque posizioni in evidenza; apri la classifica completa quando serve.</CardMeta>
        </div>
        <div className="cs-card cs-card--subdued px-3 py-2 text-center">
          <div className="cs-type-label">Squadre</div>
          <div className="text-lg font-bold leading-none tabular-nums text-[color:var(--cs-ink)]">{rows.length}</div>
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
                <td colSpan={8} className="py-6 text-center text-secondary">{emptyText}</td>
              </tr>
            )}
            {visibleRows.map((row, index) => (
              <tr key={row.club_team_id} className={row.is_csr ? 'bg-[color:var(--cs-surface-selected)]' : undefined}>
                <td className="font-semibold tabular-nums text-secondary">{index + 1}</td>
                <td className="font-semibold">
                  <span>{row.team_name}</span>
                  {row.is_csr ? <span className="ml-2 inline-flex rounded-full border border-[color:var(--cs-primary)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--cs-primary)]">CSRoma</span> : null}
                </td>
                <td className="tabular-nums">{row.class_points}</td>
                <td className="tabular-nums">{row.matches_played}</td>
                <td className="tabular-nums">{row.wins}</td>
                <td className="tabular-nums">{row.losses}</td>
                <td className="tabular-nums">{row.sets_for}-{row.sets_against}</td>
                <td className="tabular-nums">{row.points_for}-{row.points_against}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {rows.length === 0 && (
          <EmptyState title={emptyText} />
        )}
        {visibleRows.map((row, index) => (
          <Card key={row.club_team_id} variant={row.is_csr ? 'subdued' : 'default'} className={`p-4 ${row.is_csr ? 'border-[color:var(--cs-primary)] bg-[color:var(--cs-surface-selected)]' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="cs-type-label">Posizione {index + 1}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--cs-ink)]">
                  <span>{row.team_name}</span>
                  {row.is_csr ? <span className="rounded-full border border-[color:var(--cs-primary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--cs-primary)]">CSRoma</span> : null}
                </div>
              </div>
              <div className="cs-card cs-card--subdued px-3 py-2 text-center">
                <div className="cs-type-label">Pts</div>
                <div className="text-lg font-bold leading-none tabular-nums">{row.class_points}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="cs-card cs-card--subdued px-3 py-2"><div className="cs-type-label">G</div><div className="font-semibold tabular-nums text-[color:var(--cs-ink)]">{row.matches_played}</div></div>
              <div className="cs-card cs-card--subdued px-3 py-2"><div className="cs-type-label">V</div><div className="font-semibold tabular-nums text-[color:var(--cs-ink)]">{row.wins}</div></div>
              <div className="cs-card cs-card--subdued px-3 py-2"><div className="cs-type-label">P</div><div className="font-semibold tabular-nums text-[color:var(--cs-ink)]">{row.losses}</div></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="cs-card cs-card--subdued px-3 py-2"><div className="cs-type-label">Set</div><div className="font-semibold tabular-nums text-[color:var(--cs-ink)]">{row.sets_for}-{row.sets_against}</div></div>
              <div className="cs-card cs-card--subdued px-3 py-2"><div className="cs-type-label">Punti</div><div className="font-semibold tabular-nums text-[color:var(--cs-ink)]">{row.points_for}-{row.points_against}</div></div>
            </div>
          </Card>
        ))}
      </div>
      {hasOverflow ? (
        <Button variant="outline" block className="mt-4 min-h-11" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Mostra prime 5' : `Mostra classifica completa (${rows.length})`}
          {showAll ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </Button>
      ) : null}
    </Card>
  )
}

type MatchListPanelProps = {
  matches: Match[]
  teamName: (clubTeamId: string) => string
}

function matchLabel(match: Match, teamName: MatchListPanelProps['teamName']) {
  return `${match.home_club_team?.name || teamName(match.home_club_team_id)} vs ${match.away_club_team?.name || teamName(match.away_club_team_id)}`
}

function matchDateLabel(match: Match) {
  const date = formatChampionshipDate(match.match_date)
  const time = match.start_time ? match.start_time.slice(0, 5) : null
  return time ? `${date} · ${time}` : date
}

export function RecentResultsPanel({ matches, teamName }: MatchListPanelProps) {
  const recentResults = [...matches]
    .filter((match) => match.status === 'completed' || match.status === 'forfeit')
    .sort((a, b) => {
      const dateA = a.match_date ? new Date(a.match_date).getTime() : 0
      const dateB = b.match_date ? new Date(b.match_date).getTime() : 0
      return dateB - dateA || (b.match_day ?? 0) - (a.match_day ?? 0)
    })
    .slice(0, 3)

  return (
    <Card variant="primary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Risultati recenti</CardTitle>
          <CardMeta>Le ultime gare concluse del girone selezionato.</CardMeta>
        </div>
        <Trophy className="mt-1 h-5 w-5 text-[color:var(--cs-accent)]" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2">
        {recentResults.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--cs-border)] px-4 py-5 text-sm text-[color:var(--cs-text-secondary)]">
            Nessun risultato recente disponibile.
          </div>
        ) : recentResults.map((match) => (
          <div key={match.id} className="flex flex-col gap-2 rounded-2xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface-subdued)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--cs-text-secondary)]">
                {match.match_day ? `Giornata ${match.match_day}` : 'Giornata'} · {matchDateLabel(match)}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-[color:var(--cs-text)]">{matchLabel(match, teamName)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-3 py-1 text-sm font-bold tabular-nums text-[color:var(--cs-text)]">
                {formatMatchScore(match.championship_match_sets)}
              </span>
              <span className="text-xs font-semibold text-[color:var(--cs-text-secondary)]">{STATUS_LABEL[match.status] || match.status}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ChampionshipSchedulePanel({ matches, teamName }: MatchListPanelProps) {
  const [showSchedule, setShowSchedule] = useState(false)

  return (
    <>
      <Card variant="primary" className="h-fit">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Calendario completo</CardTitle>
            <CardMeta>Partite del girone selezionato, consultabili quando servono.</CardMeta>
          </div>
          <CalendarDays className="mt-1 h-5 w-5 text-[color:var(--cs-primary)]" aria-hidden="true" />
        </div>
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-[color:var(--cs-surface-subdued)] px-4 py-4 text-sm text-[color:var(--cs-text-secondary)]">
            {matches.length === 0 ? 'Nessuna partita disponibile nel girone selezionato.' : `${matches.length} partite nel calendario del girone.`}
          </div>
          <Button variant="outline" block onClick={() => setShowSchedule((current) => !current)} aria-expanded={showSchedule}>
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {showSchedule ? 'Nascondi calendario' : 'Mostra calendario'}
            {showSchedule ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </Card>

      {showSchedule ? (
        <Card variant="primary" className="xl:col-span-2">
          <CardTitle>Partite del girone</CardTitle>
          <CardMeta>Calendario completo del contesto selezionato.</CardMeta>
          <div className="mt-4 overflow-x-auto hidden md:block">
            <Table compact className="min-w-full">
              <thead><tr><th>Giornata</th><th>Data/Ora</th><th>Partita</th><th>Stato</th><th>Risultato</th><th>Set</th></tr></thead>
              <tbody>
                {matches.length === 0 ? <tr><td colSpan={6} className="py-4 text-center text-slate-400">Nessuna partita</td></tr> : matches.map((match) => (
                  <tr key={match.id}>
                    <td className="tabular-nums">{match.match_day ?? '—'}</td>
                    <td className="tabular-nums">{matchDateLabel(match)}</td>
                    <td><div className="font-semibold">{matchLabel(match, teamName)}</div><div className="text-xs text-slate-500">{match.location_text || 'Luogo da definire'}</div></td>
                    <td>{STATUS_LABEL[match.status] || match.status}</td>
                    <td className="font-semibold tabular-nums">{formatMatchScore(match.championship_match_sets)}</td>
                    <td className="text-sm text-slate-600 tabular-nums">{formatMatchSetsDetail(match.championship_match_sets) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {matches.length === 0 ? <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">Nessuna partita</div> : matches.map((match) => (
              <div key={match.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{match.match_day ? `Giornata ${match.match_day}` : 'Giornata da definire'}</div><div className="mt-1 text-sm font-semibold text-slate-900">{matchDateLabel(match)}</div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-700">{formatMatchScore(match.championship_match_sets)}</span></div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{STATUS_LABEL[match.status] || match.status}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{matchLabel(match, teamName)}</div>
                <div className="mt-3 space-y-1 text-sm text-slate-600"><div><span className="font-medium text-slate-700">Set:</span> {formatMatchSetsDetail(match.championship_match_sets) || '—'}</div><div><span className="font-medium text-slate-700">Luogo:</span> {match.location_text || 'Luogo da definire'}</div></div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
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
    <div className="max-h-[min(24rem,calc(100vh-20rem))] space-y-2 overflow-y-auto pr-1">
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
    <div className="max-h-[min(24rem,calc(100vh-20rem))] space-y-2 overflow-y-auto pr-1">
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
