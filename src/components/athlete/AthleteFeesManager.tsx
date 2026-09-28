'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { EmptyState, ErrorState, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import type { AthleteFeeInstallment, AthleteFeesContract, AthleteFeeStatus } from '@/types/athlete-fees'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { FeeRow } from './FeeRow'

type FeeFilter = 'all' | 'pending' | 'paid' | 'overdue'
type FeesLoadState = 'loading' | 'ready' | 'error' | 'offline'
const FILTERS: Array<{ value: FeeFilter; label: string }> = [
  { value: 'all', label: 'Tutte' }, { value: 'pending', label: 'Da pagare' }, { value: 'paid', label: 'Pagate' }, { value: 'overdue', label: 'Scadute' },
]

function formatAmount(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
}
function isPending(installment: AthleteFeeInstallment): boolean { return installment.status !== 'paid' }
function groupByTeam(installments: AthleteFeeInstallment[]) {
  const groups = new Map<string, { team: AthleteFeeInstallment['membership_fee']['team']; installments: AthleteFeeInstallment[] }>()
  installments.forEach((installment) => {
    const team = installment.membership_fee.team
    const group = groups.get(team.id) ?? { team, installments: [] }
    group.installments.push(installment)
    groups.set(team.id, group)
  })
  return [...groups.values()]
}
function countByStatus(installments: AthleteFeeInstallment[], status: AthleteFeeStatus): number {
  return installments.filter((installment) => installment.status === status).length
}

export default function AthleteFeesManager() {
  const { user, loading: authLoading, profileLoading } = useAuth()
  const { selectedProfileId, selectedProfile, activeArea } = useAccessibleProfiles()
  const userId = user?.id ?? null
  const [installments, setInstallments] = useState<AthleteFeeInstallment[]>([])
  const [filter, setFilter] = useState<FeeFilter>('all')
  const [loadState, setLoadState] = useState<FeesLoadState>('loading')
  const [accessDenied, setAccessDenied] = useState(false)
  const fetchControllerRef = useRef<AbortController | null>(null)
  const subjectContextRef = useRef<string>('self')

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectContextRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? 'self'
      fetchControllerRef.current?.abort()
      setInstallments([])
      setAccessDenied(false)
      setLoadState('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadInstallments = useCallback(async (signal?: AbortSignal) => {
    subjectContextRef.current = selectedProfileId ?? 'self'
    if (!userId) { setInstallments([]); setLoadState('ready'); return }
    if (activeArea === 'family' && (!selectedProfile || !selectedProfile.relationship.permissions.view_payments)) {
      setAccessDenied(true); setInstallments([]); setLoadState('ready'); return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setLoadState('offline'); return }
    setLoadState('loading'); setAccessDenied(false)
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/fees', selectedProfileId), { signal, cache: 'no-store' })
      if (!response.ok) {
        if (response.status === 403) {
          setAccessDenied(true); setInstallments([]); setLoadState('ready'); return
        }
        setLoadState('error'); return
      }
      const result = await response.json() as Partial<AthleteFeesContract>
      if (signal?.aborted || subjectContextRef.current !== (selectedProfileId ?? 'self')) return
      setInstallments(result.installments ?? [])
      setLoadState('ready')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setLoadState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    }
  }, [activeArea, selectedProfile, selectedProfileId, userId])

  useEffect(() => {
    if (authLoading || profileLoading) return
    const subjectContext = selectedProfileId ?? 'self'
    if (subjectContextRef.current !== subjectContext) {
      subjectContextRef.current = subjectContext
      setInstallments([])
      setAccessDenied(false)
    }
    fetchControllerRef.current?.abort()
    const controller = new AbortController()
    fetchControllerRef.current = controller
    void loadInstallments(controller.signal)
    return () => controller.abort()
  }, [authLoading, profileLoading, loadInstallments, selectedProfileId])

  useEffect(() => {
    const handleOffline = () => setLoadState('offline')
    const handleOnline = () => { void loadInstallments() }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadInstallments])

  const filteredInstallments = useMemo(() => installments.filter((installment) => {
    if (filter === 'paid') return installment.status === 'paid'
    if (filter === 'overdue') return installment.status === 'overdue'
    if (filter === 'pending') return isPending(installment)
    return true
  }), [filter, installments])
  const totals = useMemo(() => installments.reduce((result, installment) => {
    result.due += installment.financials.due_amount
    result.paid += installment.financials.paid_amount ?? 0
    result.remaining += installment.financials.remaining_amount ?? installment.financials.due_amount
    return result
  }, { due: 0, paid: 0, remaining: 0 }), [installments])
  const groups = useMemo(() => groupByTeam(filteredInstallments), [filteredInstallments])
  const filterCount = (value: FeeFilter) => value === 'all' ? installments.length : value === 'pending' ? installments.filter(isPending).length : value === 'paid' ? countByStatus(installments, 'paid') : countByStatus(installments, 'overdue')

  if (loadState === 'loading' && installments.length === 0) return <LoadingState label="Caricamento quote..." />
  if (accessDenied) return <DelegatedAccessDenied section="le quote associative" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  const retryAction = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadInstallments()}>Riprova</button>
  if (loadState === 'offline' && installments.length === 0) return <OfflineState title="Quote non disponibili offline" description="Le quote richiedono una connessione. Quando torni online, riprova." action={retryAction} />
  if (loadState === 'error' && installments.length === 0) return <ErrorState title="Non è stato possibile caricare le quote" description="Riprova tra poco." action={retryAction} />

  return (
    <div className="space-y-5">
      {loadState === 'offline' ? <OfflineState title="Quote non aggiornate" description="Sei offline. I dati mostrati potrebbero non essere aggiornati; le modifiche non sono disponibili." action={retryAction} className="py-6 text-left" /> : null}
      {loadState === 'error' ? <ErrorState title="Aggiornamento quote non riuscito" description="I dati mostrati potrebbero non essere aggiornati." action={retryAction} className="py-6 text-left" /> : null}
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Quote associative</p><h2 className="mt-1 text-xl font-bold text-[color:var(--cs-text)]">Situazione economica</h2></div>
          <StatusBadge status="info" label={`${installments.length} ${installments.length === 1 ? 'rata' : 'rate'}`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--cs-r-md)] border border-[color:var(--cs-border-canonical)] p-3"><p className="text-xs text-[color:var(--cs-text-secondary)]">Totale dovuto</p><p className="mt-1 font-variant-numeric tabular-nums text-xl font-bold">{formatAmount(totals.due)}</p></div>
          <div className="rounded-[var(--cs-r-md)] border border-[color:var(--cs-border-canonical)] p-3"><p className="text-xs text-[color:var(--cs-text-secondary)]">Già pagato</p><p className="mt-1 font-variant-numeric tabular-nums text-xl font-bold text-[color:var(--cs-success-canonical)]">{formatAmount(totals.paid)}</p></div>
          <div className="rounded-[var(--cs-r-md)] border border-[color:var(--cs-border-canonical)] p-3"><p className="text-xs text-[color:var(--cs-text-secondary)]">Residuo</p><p className="mt-1 font-variant-numeric tabular-nums text-xl font-bold text-[color:var(--cs-brand-red)]">{formatAmount(totals.remaining)}</p></div>
        </div>
      </Panel>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtra quote">
        {FILTERS.map(({ value, label }) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`cs-btn cs-btn--sm min-h-11 shrink-0 ${filter === value ? 'cs-btn--warm' : 'cs-btn--outline'}`}>{label} <span className="ml-1 tabular-nums">{filterCount(value)}</span></button>)}
      </div>

      {installments.length === 0 ? <EmptyState title="Nessuna quota associativa trovata" description="Contatta l'amministratore per informazioni sulle quote." /> : filteredInstallments.length === 0 ? <EmptyState filtered title="Nessuna rata per questo filtro" /> : <div className="space-y-4">
        {groups.map(({ team, installments: teamInstallments }) => <Panel key={team.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--cs-border-canonical)] px-4 py-3"><div className="min-w-0"><h3 className="truncate font-semibold text-[color:var(--cs-text)]">{team.name} <span className="font-normal text-[color:var(--cs-text-secondary)]">({team.code})</span></h3><p className="truncate text-xs text-[color:var(--cs-text-secondary)]">{team.activity.name}</p></div><span className="shrink-0 text-xs text-[color:var(--cs-text-secondary)]">{teamInstallments.length} {teamInstallments.length === 1 ? 'rata' : 'rate'}</span></div>
          {teamInstallments.map((installment) => <FeeRow key={installment.id} installment={installment} />)}
        </Panel>)}
      </div>}
    </div>
  )
}
