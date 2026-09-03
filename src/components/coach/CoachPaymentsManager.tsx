'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeniedState, EmptyState, ErrorState, FeedbackState, LoadingState, OfflineState, Panel, Stat, StatusBadge } from '@/components/ui'
import { useTeamContext } from '@/context/TeamContext'
import { loadStateFromError, loadStateFromStatus, type LoadState } from '@/lib/ui/load-state'

type Payment = {
  id: string
  type: 'coach_payment'
  description: string
  amount: number
  frequency: 'one_time' | 'recurring'
  status: 'pending' | 'paid'
  due_date?: string
  paid_at?: string
  teams?: { id: string; name: string; code: string } | null
  activities?: { id: string; name: string } | null
}

function formatCurrency(amount: number) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount || 0) }
function formatDate(value?: string) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT', { dateStyle: 'medium' }) : 'Data non indicata' }

export default function CoachPaymentsManager() {
  const { teams, selectedTeamId, selectedTeam } = useTeamContext()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all')

  useEffect(() => {
    let active = true
    let classifiedResponseError = false
    setLoadState('ready')
    setLoadError(null)
    setLoading(true)
    const teamQuery = selectedTeamId ? `?team_id=${encodeURIComponent(selectedTeamId)}` : ''
    fetch(`/api/coach/payments${teamQuery}`, { cache: 'no-store' })
      .then(async (response) => { const data = await response.json(); if (!response.ok) { classifiedResponseError = true; if (active) { setLoadState(loadStateFromStatus(response.status)); setLoadError(response.status === 403 ? 'Non hai i permessi per visualizzare i compensi.' : 'Compensi non disponibili.') }; throw new Error(data?.error || 'Errore caricamento') }; if (active) setPayments(Array.isArray(data) ? data : []) })
      .catch((error) => { console.error('Errore caricamento pagamenti coach:', error); if (active && !classifiedResponseError) { setLoadState(loadStateFromError(error)); setLoadError('Impossibile caricare i compensi.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedTeamId])

  const teamFiltered = useMemo(() => selectedTeamId ? payments.filter((payment) => payment.teams?.id === selectedTeamId) : payments, [payments, selectedTeamId])
  const filtered = useMemo(() => teamFiltered.filter((payment) => filterStatus === 'all' || payment.status === filterStatus), [teamFiltered, filterStatus])
  const totals = useMemo(() => ({
    total: filtered.reduce((sum, payment) => sum + (payment.amount || 0), 0),
    pending: filtered.filter((payment) => payment.status === 'pending').reduce((sum, payment) => sum + (payment.amount || 0), 0),
    paid: filtered.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (payment.amount || 0), 0),
  }), [filtered])

  if (loading) return <LoadingState label="Caricamento compensi coach..." />
  if (loadError && payments.length === 0) {
    const action = <button type="button" className="cs-btn cs-btn--outline" onClick={() => window.location.reload()}>Riprova</button>
    if (loadState === 'denied') return <DeniedState title="Compensi non disponibili" description={loadError} action={action} />
    if (loadState === 'offline') return <OfflineState title="Compensi non disponibili offline" description="Controlla la connessione e riprova." action={action} />
    return <ErrorState title="Compensi non disponibili" description={loadError} action={action} />
  }
  return (
    <div className="space-y-5">
      {loadError && payments.length > 0 ? <FeedbackState variant={loadState === 'denied' ? 'denied' : loadState === 'offline' ? 'offline' : 'error'} title="Aggiornamento parziale" description={loadState === 'denied' ? 'Alcuni compensi non sono disponibili per il tuo account.' : loadState === 'offline' ? 'I compensi visualizzati potrebbero non essere aggiornati.' : loadError} /> : null}
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Area personale</p><h1 className="cs-type-h1 mt-1">Compensi coach</h1><p className="mt-1 text-sm text-[color:var(--cs-ink-muted)]">Pagamenti personali assegnati dall’amministrazione{selectedTeam ? ` · ${selectedTeam.name}` : ''}.</p></div><span className="cs-badge cs-badge--neutral">Non sono quote atleta</span></header>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Totale visualizzato" value={formatCurrency(totals.total)} description={`${filtered.length} ${filtered.length === 1 ? 'voce' : 'voci'}`} variant="primary" /><Stat label="Da ricevere" value={formatCurrency(totals.pending)} description={`${filtered.filter((payment) => payment.status === 'pending').length} in sospeso`} variant="accent" /><Stat label="Ricevuto" value={formatCurrency(totals.paid)} description={`${filtered.filter((payment) => payment.status === 'paid').length} completati`} variant="neutral" /></div>
      <Panel><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Filtra compensi</h2><p className="text-sm text-[color:var(--cs-ink-muted)]">La vista riguarda solo il tuo incarico coach{teams.length > 1 ? '; usa Squadra nell’intestazione per restringere il registro.' : '.'}</p></div><label className="cs-field__label flex items-center gap-2">Stato<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)} className="cs-select"><option value="all">Tutti</option><option value="pending">Da ricevere</option><option value="paid">Ricevuti</option></select></label></div></Panel>
      <Panel><div className="flex items-end justify-between gap-3"><div><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Registro personale</p><h2 className="mt-1 text-lg font-bold">Dettaglio compensi</h2></div><span className="text-sm text-[color:var(--cs-ink-muted)]">{filtered.length} {filtered.length === 1 ? 'voce' : 'voci'}</span></div>{filtered.length === 0 ? <div className="mt-4"><EmptyState filtered={payments.length > 0} title={payments.length > 0 ? 'Nessun compenso corrispondente' : 'Nessun compenso'} description={payments.length > 0 ? 'Prova a modificare squadra o stato.' : 'Qui vedrai i compensi coach assegnati dall’amministrazione.'} /></div> : <ul className="mt-4 m-0 list-none divide-y divide-[color:var(--cs-border-canonical)] p-0">{filtered.map((payment) => <li key={payment.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{payment.description}</h3><p className="mt-1 text-sm text-[color:var(--cs-ink-muted)]">{payment.frequency === 'one_time' ? 'Una tantum' : 'Ricorrente'}{payment.teams ? ` · ${payment.teams.name}` : ''}{payment.activities ? ` · ${payment.activities.name}` : ''}</p><p className="mt-1 text-xs text-[color:var(--cs-ink-muted)]">{payment.status === 'paid' && payment.paid_at ? `Ricevuto il ${formatDate(payment.paid_at)}` : `Scadenza: ${formatDate(payment.due_date)}`}</p></div><div className="text-right"><p className="font-bold tabular-nums">{formatCurrency(payment.amount)}</p><StatusBadge status={payment.status === 'paid' ? 'success' : 'pending'} label={payment.status === 'paid' ? 'Ricevuto' : 'Da ricevere'} /></div></div></li>)}</ul>}</Panel>
    </div>
  )
}
