'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { usePush } from '@/hooks/usePush'
import InstallPwaButton from '@/components/pwa/InstallPwaButton'
import { DeniedState, ErrorState, ListRow, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import { loadStateFromError, type LoadState } from '@/lib/ui/load-state'

type CoachDetails = { level: string | null; specialization: string | null; started_on: string | null }
type TeamAssignment = { id: string; name: string; code: string; role: string | null; assigned_at: string | null }

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('it-IT', { dateStyle: 'long' })
}

export default function CoachProfileManager() {
  const { user, profile, account, loading: authLoading, profileLoading } = useAuth()
  const { subscribe, unsubscribe } = usePush()
  const supabase = useMemo(() => createClient(), [])
  const [coachDetails, setCoachDetails] = useState<CoachDetails | null>(null)
  const [assignments, setAssignments] = useState<TeamAssignment[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  const loadCoachData = useCallback(async () => {
    if (!profile?.id) return
    setLoadError(false)
    setLoadState('ready')
    const [coachResult, assignmentResult] = await Promise.all([
      supabase.from('coach_profiles').select('level, specialization, started_on').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('team_coaches').select('team_id, role, assigned_at, teams(id, name, code)').eq('coach_id', profile.id),
    ])
    if (coachResult.error || assignmentResult.error) {
      setLoadError(true)
      const error = coachResult.error ?? assignmentResult.error
      setLoadState(error?.code === '42501' ? 'denied' : loadStateFromError(error))
      return
    }
    setCoachDetails((coachResult.data as CoachDetails | null) ?? null)
    setAssignments(((assignmentResult.data ?? []) as Array<{ team_id: string; role: string | null; assigned_at: string | null; teams?: { id: string; name: string; code: string } | Array<{ id: string; name: string; code: string }> | null }>)
      .flatMap((assignment) => {
        const team = Array.isArray(assignment.teams) ? assignment.teams[0] : assignment.teams
        return team ? [{ ...team, role: assignment.role, assigned_at: assignment.assigned_at }] : []
      })
      .sort((a, b) => a.name.localeCompare(b.name)))
  }, [profile?.id, supabase])

  useEffect(() => {
    if (!profile?.id) return
    void loadCoachData()
  }, [loadCoachData, profile?.id])

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    navigator.serviceWorker.getRegistration().then(async (registration) => setIsSubscribed(Boolean(await registration?.pushManager.getSubscription()))).catch(() => setIsSubscribed(false))
  }, [])

  const handlePush = async () => {
    setPushBusy(true)
    try {
      if (isSubscribed) {
        await unsubscribe()
        setIsSubscribed(false)
      } else {
        await subscribe('Dispositivo personale')
        setPushPermission(Notification.permission)
        setIsSubscribed(true)
      }
    } finally {
      setPushBusy(false)
    }
  }

  if (authLoading || profileLoading) return <LoadingState label="Caricamento profilo coach..." />
  if (!user || !profile) return <ErrorState title="Profilo non disponibile" description="Non è stato possibile caricare i dati dell'account." />
  if (loadError) {
    const action = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadCoachData()}>Riprova</button>
    if (loadState === 'denied') return <DeniedState title="Dati coach non disponibili" description="Non hai i permessi per visualizzare queste informazioni." action={action} />
    if (loadState === 'offline') return <OfflineState title="Profilo coach non disponibile offline" description="Controlla la connessione e riprova." action={action} />
    return <ErrorState title="Dati coach non disponibili" description="Riprova per caricare assegnazioni e informazioni professionali." action={action} />
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim()
  return (
    <div className="space-y-5">
      <header>
        <p className="cs-type-label text-[color:var(--cs-ink-muted)]">Area personale</p>
        <h1 className="cs-type-h1 mt-1">Profilo coach</h1>
        <p className="mt-1 text-sm text-[color:var(--cs-ink-muted)]">Dati dell’account e incarico sportivo del coach.</p>
      </header>

      <Panel className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[color:var(--cs-brand-red)] text-xl font-bold text-white" aria-label={`Iniziali di ${fullName}`}>{initials(profile.first_name, profile.last_name)}</div>
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-[color:var(--cs-ink-muted)]">Identità account</p><h2 className="truncate text-xl font-bold">{fullName}</h2><p className="text-sm text-[color:var(--cs-ink-muted)]">{profile.email ?? user.email ?? 'Email non disponibile'}</p></div>
        <StatusBadge status="info" label="Coach" />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Account</p><h2 className="mt-1 text-lg font-bold">Dati personali</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-[color:var(--cs-ink-muted)]">Email</dt><dd className="mt-1 break-words font-semibold">{profile.email ?? user.email ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-ink-muted)]">Telefono</dt><dd className="mt-1 font-semibold">{(profile as { phone_number?: string | null }).phone_number ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-ink-muted)]">Stato account</dt><dd className="mt-1 font-semibold">{account?.accountStatus ?? '—'}</dd></div></dl></Panel>
        <Panel><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Incarico</p><h2 className="mt-1 text-lg font-bold">Profilo professionale</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[color:var(--cs-ink-muted)]">Livello</dt><dd className="mt-1 font-semibold">{coachDetails?.level ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-ink-muted)]">Specializzazione</dt><dd className="mt-1 font-semibold">{coachDetails?.specialization ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-ink-muted)]">Inizio collaborazione</dt><dd className="mt-1 font-semibold">{formatDate(coachDetails?.started_on)}</dd></div></dl></Panel>
      </div>

      <Panel><div className="flex items-end justify-between gap-3"><div><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Contesto operativo</p><h2 className="mt-1 text-lg font-bold">Squadre assegnate</h2></div><span className="text-sm text-[color:var(--cs-ink-muted)]">{assignments.length} {assignments.length === 1 ? 'squadra' : 'squadre'}</span></div>{assignments.length === 0 ? <p className="mt-4 text-sm text-[color:var(--cs-ink-muted)]">Nessuna squadra assegnata.</p> : <ul className="mt-4 m-0 list-none divide-y divide-[color:var(--cs-border-canonical)] p-0">{assignments.map((team) => <li key={team.id}><ListRow className="px-0 py-3" leading={<span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--cs-surface-selected)] text-sm">🏀</span>}><div className="min-w-0"><p className="truncate font-semibold">{team.name} <span className="font-normal text-[color:var(--cs-ink-muted)]">({team.code})</span></p><p className="text-sm text-[color:var(--cs-ink-muted)]">Ruolo: {team.role ?? 'Coach'} · Assegnato il {formatDate(team.assigned_at)}</p></div></ListRow></li>)}</ul>}</Panel>

      <div className="grid gap-5 lg:grid-cols-2"><Panel><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Preferenze account</p><h2 className="mt-1 text-lg font-bold">Notifiche push</h2><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-[color:var(--cs-ink-muted)]">{!pushSupported ? 'Non supportate da questo browser.' : pushPermission === 'denied' ? 'Permesso negato dal browser.' : isSubscribed ? 'Attive su questo dispositivo.' : 'Non attive.'}</p>{pushSupported && pushPermission !== 'denied' ? <button type="button" disabled={pushBusy} className="cs-btn cs-btn--outline min-h-11 shrink-0" onClick={() => void handlePush()}>{pushBusy ? 'Aggiornamento...' : isSubscribed ? 'Disattiva' : 'Attiva'}</button> : null}</div></Panel><Panel><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Accesso</p><h2 className="mt-1 text-lg font-bold">App CSRoma</h2><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[color:var(--cs-ink-muted)]">Installa la PWA per un accesso più rapido.</p><InstallPwaButton /></div></Panel></div>
    </div>
  )
}
