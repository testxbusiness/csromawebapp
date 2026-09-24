'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, FeedbackState, LoadingState } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getRolloverSeasonContext } from '@/lib/seasons/rollover'

type Season = { id?: string; name: string; start_date: string; end_date: string; is_active: boolean }
type Step = 'season' | 'structures' | 'teams' | 'profiles' | 'assignments' | 'summary'
type StructureChoice = { sourceId: string; choice: 'copy' | 'link' | 'skip'; targetId?: string }
type TeamChoice = { sourceId: string; choice: 'create' | 'link' | 'skip'; name?: string; code?: string; activityId?: string; targetId?: string }
type Assignment = { teamId: string; role: string; jerseyNumber: number | null }
type Profile = {
  profile: { id: string; firstName: string; lastName: string }
  category: 'athlete' | 'collaborator'
  status: string
  sourceTeams: Array<{ id: string; name: string; code: string; jerseyNumber: number | null; role: string }>
  targetTeams: Array<{ id: string; name: string; code: string; sourceTeamId: string }>
  family: Array<{ relationshipType: string; permissions: string[] }>
  warnings: Array<{ code: string; message: string }>
}
type StructurePreview = { source: { id: string; name: string }; matches: Array<{ id: string; name: string; season_id: string }>; mappedTargetId: string | null }
type TeamPreview = { source: { id: string; name: string; code: string; activity_id: string; activity: { id: string; name: string; season_id: string } | null }; mappedActivity: { id: string; name: string; season_id: string } | null; targetMatches: Array<{ id: string; name: string; code: string; activity_id: string; is_active: boolean }>; mappedTargetId: string | null; proposedCode: string }

const steps: Array<{ id: Step; label: string }> = [
  { id: 'season', label: 'Stagione' },
  { id: 'structures', label: 'Palestre e attività' },
  { id: 'teams', label: 'Squadre' },
  { id: 'profiles', label: 'Profili' },
  { id: 'assignments', label: 'Assegnazioni' },
  { id: 'summary', label: 'Riepilogo' },
]

function readError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') return payload.error
  return fallback
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sei offline. Riconnettiti prima di continuare.')
  const response = await fetch(url, init)
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(payload, 'Impossibile completare l’operazione'))
  return payload as T
}

function choiceForSource<T extends { sourceId: string }>(choices: T[], sourceId: string): T | undefined {
  return choices.find((choice) => choice.sourceId === sourceId)
}

function createBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return '00000000-0000-4000-8000-' + `${Date.now()}${Math.floor(Math.random() * 100000000)}`.slice(-12).padStart(12, '0')
}

export default function SeasonRolloverWizard({ seasons, onClose, onCompleted }: { seasons: Season[]; onClose: () => void; onCompleted: () => void }) {
  const rolloverSeasons = useMemo(() => seasons.filter((season): season is Season & { id: string } => Boolean(season.id)), [seasons])
  const rolloverContext = useMemo(() => getRolloverSeasonContext(rolloverSeasons), [rolloverSeasons])
  const source = rolloverContext.source
  const [targetSeasonId, setTargetSeasonId] = useState(rolloverContext.defaultTarget?.id ?? '')
  const target = rolloverContext.targets.find((season) => season.id === targetSeasonId) ?? null
  const [step, setStep] = useState<Step>('season')
  const [structurePreview, setStructurePreview] = useState<{ gyms: StructurePreview[]; activities: StructurePreview[] } | null>(null)
  const [teamPreview, setTeamPreview] = useState<{ teams: TeamPreview[]; targetTeams: Array<{ id: string; name: string; code: string; activity_id: string; is_active: boolean; activity: { id: string; name: string } | null }> } | null>(null)
  const [profilePreview, setProfilePreview] = useState<{ athletes: Profile[]; collaborators: Profile[] } | null>(null)
  const [gymChoices, setGymChoices] = useState<StructureChoice[]>([])
  const [activityChoices, setActivityChoices] = useState<StructureChoice[]>([])
  const [teamChoices, setTeamChoices] = useState<TeamChoice[]>([])
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | 'athlete' | 'collaborator'>('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lastAction, setLastAction] = useState<'load' | 'next'>('load')
  const [batchId] = useState(createBatchId)

  useEffect(() => {
    if (!rolloverContext.targets.some((season) => season.id === targetSeasonId)) {
      setTargetSeasonId(rolloverContext.defaultTarget?.id ?? '')
    }
  }, [rolloverContext.defaultTarget?.id, rolloverContext.targets, targetSeasonId])

  const selectTargetSeason = (nextTargetId: string) => {
    setTargetSeasonId(nextTargetId)
    setStructurePreview(null)
    setTeamPreview(null)
    setProfilePreview(null)
    setGymChoices([])
    setActivityChoices([])
    setTeamChoices([])
    setIncluded({})
    setAssignments({})
    setConfirm(false)
    setError(null)
    setSubmitted(false)
  }

  const allProfiles = useMemo(() => profilePreview ? [...profilePreview.athletes, ...profilePreview.collaborators] : [], [profilePreview])
  const filteredProfiles = useMemo(() => allProfiles.filter((profile) => {
    const name = `${profile.profile.firstName} ${profile.profile.lastName}`.toLocaleLowerCase()
    const matchesQuery = name.includes(query.toLocaleLowerCase())
    const matchesCategory = category === 'all' || profile.category === category
    const matchesTeam = teamFilter === 'all' || profile.sourceTeams.some((team) => team.id === teamFilter)
    return matchesQuery && matchesCategory && matchesTeam
  }), [allProfiles, category, query, teamFilter])
  const includedCount = allProfiles.filter((profile) => included[profile.profile.id]).length
  const excludedCount = allProfiles.length - includedCount
  const withoutTeamCount = allProfiles.filter((profile) => included[profile.profile.id] && (assignments[profile.profile.id] ?? []).length === 0).length

  const loadStep = useCallback(async (nextStep: Step, action: 'load' | 'next' = 'load') => {
    if (!source?.id || !target?.id) return
    setLoading(true)
    setError(null)
    setLastAction(action)
    try {
      if (nextStep === 'structures' && !structurePreview) {
        const data = await requestJson<{ gyms: StructurePreview[]; activities: StructurePreview[] }>(`/api/admin/season-structures?sourceSeasonId=${source.id}&targetSeasonId=${target.id}`)
        setStructurePreview(data)
        setGymChoices(data.gyms.map((item) => ({ sourceId: item.source.id, choice: item.mappedTargetId ? 'link' : 'skip', ...(item.mappedTargetId ? { targetId: item.mappedTargetId } : {}) })))
        setActivityChoices(data.activities.map((item) => ({ sourceId: item.source.id, choice: item.mappedTargetId ? 'link' : 'skip', ...(item.mappedTargetId ? { targetId: item.mappedTargetId } : {}) })))
      }
      if (nextStep === 'teams' && !teamPreview) {
        const data = await requestJson<{ teams: TeamPreview[]; targetTeams: Array<{ id: string; name: string; code: string; activity_id: string; is_active: boolean; activity: { id: string; name: string } | null }> }>(`/api/admin/season-teams?sourceSeasonId=${source.id}&targetSeasonId=${target.id}`)
        setTeamPreview(data)
        setTeamChoices(data.teams.map((item) => item.mappedTargetId ? { sourceId: item.source.id, choice: 'link', targetId: item.mappedTargetId } : { sourceId: item.source.id, choice: 'skip' }))
      }
      if (nextStep === 'profiles' && !profilePreview) {
        const data = await requestJson<{ athletes: Profile[]; collaborators: Profile[]; sourceSeason: unknown; targetSeason: unknown }>(`/api/admin/season-profiles?sourceSeasonId=${source.id}&targetSeasonId=${target.id}`)
        setProfilePreview(data)
        setIncluded(Object.fromEntries([...data.athletes, ...data.collaborators].map((profile) => [profile.profile.id, false])))
      }
      setStep(nextStep)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile caricare il passo')
    } finally {
      setLoading(false)
    }
  }, [profilePreview, source?.id, structurePreview, target?.id, teamPreview])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!submitted && step !== 'season') { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [step, submitted])

  const persistStructureChoices = async () => {
    if (!source?.id || !target?.id || !structurePreview) return
    await requestJson('/api/admin/season-structures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSeasonId: source.id, targetSeasonId: target.id, gyms: gymChoices, activities: activityChoices }) })
  }
  const persistTeamChoices = async () => {
    if (!source?.id || !target?.id || !teamPreview) return
    await requestJson('/api/admin/season-teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSeasonId: source.id, targetSeasonId: target.id, teams: teamChoices }) })
  }

  const goNext = async () => {
    const index = steps.findIndex((item) => item.id === step)
    try {
      setLastAction('next')
      setLoading(true)
      setError(null)
      if (step === 'structures') await persistStructureChoices()
      if (step === 'teams') await persistTeamChoices()
      setLoading(false)
      if (index < steps.length - 1) await loadStep(steps[index + 1].id, 'next')
    } catch (cause) {
      setLoading(false)
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare le scelte')
    }
  }

  const goBack = () => {
    const index = steps.findIndex((item) => item.id === step)
    if (index > 0) setStep(steps[index - 1].id)
  }

  const toggleProfile = (profile: Profile) => {
    const next = !included[profile.profile.id]
    setIncluded((current) => ({ ...current, [profile.profile.id]: next }))
    if (next && profile.targetTeams.length === 1 && !assignments[profile.profile.id]) {
      setAssignments((current) => ({ ...current, [profile.profile.id]: proposedAssignments(profile) }))
    }
  }

  const proposedAssignments = (profile: Profile): Assignment[] => {
    if (profile.targetTeams.length !== 1) return []
    const targetTeam = profile.targetTeams[0]
    const sourceTeam = profile.sourceTeams.find((team) => team.id === targetTeam.sourceTeamId)
    return [{ teamId: targetTeam.id, role: sourceTeam?.role ?? (profile.category === 'athlete' ? 'athlete' : 'coach'), jerseyNumber: sourceTeam?.jerseyNumber ?? null }]
  }

  const includeFilteredProfiles = () => {
    setIncluded((current) => ({ ...current, ...Object.fromEntries(filteredProfiles.map((profile) => [profile.profile.id, true])) }))
    setAssignments((current) => ({ ...current, ...Object.fromEntries(filteredProfiles.filter((profile) => !current[profile.profile.id]).map((profile) => [profile.profile.id, proposedAssignments(profile)])) }))
  }

  const toggleAssignment = (profile: Profile, teamId: string) => {
    const current = assignments[profile.profile.id] ?? []
    const existing = current.find((assignment) => assignment.teamId === teamId)
    if (existing) setAssignments((all) => ({ ...all, [profile.profile.id]: current.filter((assignment) => assignment.teamId !== teamId) }))
    else {
      const targetTeam = profile.targetTeams.find((team) => team.id === teamId)
      const sourceTeam = profile.sourceTeams.find((team) => team.id === targetTeam?.sourceTeamId)
      setAssignments((all) => ({ ...all, [profile.profile.id]: [...current, { teamId, role: sourceTeam?.role ?? (profile.category === 'athlete' ? 'athlete' : 'coach'), jerseyNumber: sourceTeam?.jerseyNumber ?? null }] }))
    }
  }

  const updateAssignment = (profileId: string, teamId: string, field: 'role' | 'jerseyNumber', value: string) => {
    setAssignments((all) => ({ ...all, [profileId]: (all[profileId] ?? []).map((assignment) => assignment.teamId === teamId ? { ...assignment, [field]: field === 'jerseyNumber' ? (value === '' ? null : Number(value)) : value } : assignment) }))
  }

  const submitBatch = async () => {
    if (!source?.id || !target?.id || !confirm || submitted) return
    setLoading(true)
    setError(null)
    try {
      await requestJson('/api/admin/season-profile-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId, sourceSeasonId: source.id, targetSeasonId: target.id, selections: allProfiles.map((profile) => ({ profileId: profile.profile.id, included: Boolean(included[profile.profile.id]), teams: included[profile.profile.id] ? (assignments[profile.profile.id] ?? []) : [] })) }) })
      setSubmitted(true)
      onCompleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile applicare il batch')
    } finally { setLoading(false) }
  }

  if (!source?.id || !target?.id) return <FeedbackState variant="error" title="Prerequisiti incompleti" description="Serve una sola stagione attiva e una bozza inattiva con inizio successivo alla sua fine." action={<Button variant="outline" onClick={onClose}>Chiudi</Button>} />
  if (submitted) return <FeedbackState variant="success" title="Selezione salvata" description={`Le iscrizioni target sono state applicate. ${source.name} resta invariata e ${target.name} resta inattiva.`} action={<Button onClick={onClose}>Chiudi</Button>} />

  return <section aria-labelledby="season-rollover-title" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="season-rollover-title" className="text-xl font-semibold">Rollover profili verso {target.name}</h2><p className="text-sm text-secondary">Bozza inattiva · nessun dato storico viene spostato o cancellato.</p></div>
      <Button variant="outline" onClick={onClose} disabled={loading}>Annulla</Button>
    </div>
    <nav aria-label="Passi del rollover" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((item, index) => <button key={item.id} type="button" aria-current={step === item.id ? 'step' : undefined} disabled={loading || index > steps.findIndex((current) => current.id === step)} onClick={() => index <= steps.findIndex((current) => current.id === step) && setStep(item.id)} className={`rounded border px-3 py-2 text-left text-sm ${step === item.id ? 'border-[color:var(--cs-primary)] bg-[color:var(--cs-surface-selected)] font-semibold' : 'border-[color:var(--cs-border)]'}`}><span className="block text-xs text-secondary">{index + 1}</span>{item.label}</button>)}
    </nav>
    {error ? <Alert variant="danger" role="alert" className="flex items-center justify-between gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={() => { setError(null); void (lastAction === 'next' ? goNext() : loadStep(step)) }}>Riprova</Button></Alert> : null}
    {loading ? <LoadingState label="Salvataggio/verifica in corso..." /> : null}

    {!loading && step === 'season' ? <Card variant="primary" className="space-y-4"><h3 className="font-semibold">Stagioni coinvolte</h3><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-secondary">Source attiva</p><p className="font-medium">{source.name}</p><p className="text-sm text-secondary">{source.start_date.slice(0, 10)} → {source.end_date.slice(0, 10)}</p></div><div><label className="text-xs text-secondary" htmlFor="rollover-target-season">Target inattiva</label><Select id="rollover-target-season" value={target.id} onChange={(event) => selectTargetSeason(event.target.value)}>{rolloverContext.targets.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select><p className="mt-1 text-sm text-secondary">{target.start_date.slice(0, 10)} → {target.end_date.slice(0, 10)}</p></div></div><Alert variant="info">Le relazioni globali di profili, account e familiari non vengono duplicate.</Alert></Card> : null}

    {!loading && step === 'structures' ? <Card className="space-y-5"><h3 className="font-semibold">Scegli cosa preparare</h3><Alert variant="info">Le copie sono solo anagrafiche. Non vengono ereditati orari, quote, eventi, staff o altre configurazioni operative.</Alert>{structurePreview ? <div className="grid gap-5 lg:grid-cols-2">{([['Palestre', structurePreview.gyms, gymChoices, setGymChoices], ['Attività', structurePreview.activities, activityChoices, setActivityChoices] ] as const).map(([label, items, choices, setChoices]) => <div key={label} className="space-y-2"><h4 className="font-medium">{label}</h4>{items.length === 0 ? <EmptyState title={`Nessuna ${label.toLocaleLowerCase()} source`} /> : items.map((item) => { const choice = choiceForSource(choices, item.source.id); return <div key={item.source.id} className="rounded border p-3"><div className="font-medium">{item.source.name}</div><div className="mt-2 flex flex-wrap gap-2"><Select aria-label={`Scelta ${label} ${item.source.name}`} value={choice?.choice ?? 'skip'} onChange={(event) => setChoices((current) => current.map((currentChoice) => currentChoice.sourceId === item.source.id ? event.target.value === 'link' ? { sourceId: item.source.id, choice: 'link', targetId: item.matches[0]?.id ?? '' } : { sourceId: item.source.id, choice: event.target.value as 'copy' | 'skip' } : currentChoice))}><option value="skip">Non portare</option><option value="copy">Copia nuova anagrafica</option><option value="link" disabled={!item.matches.length}>Collega a target esistente</option></Select>{choice?.choice === 'link' && item.matches.length > 1 ? <Select aria-label={`Target ${item.source.name}`} value={choice.targetId ?? ''} onChange={(event) => setChoices((current) => current.map((currentChoice) => currentChoice.sourceId === item.source.id ? { ...currentChoice, targetId: event.target.value } : currentChoice))}>{item.matches.map((match) => <option key={match.id} value={match.id}>{match.name}</option>)}</Select> : null}</div></div> })}</div>)}</div> : null}</Card> : null}

    {!loading && step === 'teams' ? <Card className="space-y-5"><h3 className="font-semibold">Prepara le squadre target</h3><Alert variant="warning">Le squadre create sono bozze: non ereditano orari, palestre, quote, campionati o staff.</Alert>{teamPreview?.teams.map((item) => { const choice = choiceForSource(teamChoices, item.source.id); return <div key={item.source.id} className="grid gap-3 rounded border p-3 md:grid-cols-[1fr_auto] md:items-center"><div><div className="font-medium">{item.source.name} <span className="text-sm text-secondary">({item.source.code})</span></div><div className="text-sm text-secondary">Attività target: {item.mappedActivity?.name ?? 'non mappata'}</div></div><div className="flex flex-wrap gap-2"><Select aria-label={`Scelta squadra ${item.source.name}`} value={choice?.choice ?? 'skip'} onChange={(event) => { const value = event.target.value; setTeamChoices((current) => current.map((currentChoice) => currentChoice.sourceId === item.source.id ? value === 'create' ? { sourceId: item.source.id, choice: 'create', name: item.source.name, code: item.proposedCode, activityId: item.mappedActivity?.id ?? item.source.activity_id } : value === 'link' ? { sourceId: item.source.id, choice: 'link', targetId: item.targetMatches[0]?.id ?? '' } : { sourceId: item.source.id, choice: 'skip' } : currentChoice)) }}><option value="skip">Non ricreare</option><option value="create" disabled={!item.mappedActivity}>Crea bozza</option><option value="link" disabled={!item.targetMatches.length}>Collega target</option></Select>{choice?.choice === 'link' && item.targetMatches.length > 1 ? <Select aria-label={`Target squadra ${item.source.name}`} value={choice.targetId ?? ''} onChange={(event) => setTeamChoices((current) => current.map((currentChoice) => currentChoice.sourceId === item.source.id ? { ...currentChoice, targetId: event.target.value } : currentChoice))}>{item.targetMatches.map((match) => <option key={match.id} value={match.id}>{match.name}</option>)}</Select> : null}</div></div>})}</Card> : null}

    {!loading && step === 'profiles' ? <Card className="space-y-4"><div className="flex flex-wrap items-end gap-3"><label className="flex-1 text-sm">Cerca profilo<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome o cognome" /></label><label className="text-sm">Tipo<Select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option value="all">Tutti</option><option value="athlete">Atleti</option><option value="collaborator">Collaboratori</option></Select></label><label className="text-sm">Squadra source<Select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">Tutte</option>{[...new Map(allProfiles.flatMap((profile) => profile.sourceTeams.map((team) => [team.id, team] as const))).values()].map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></label><Button variant="outline" onClick={includeFilteredProfiles}>Includi risultati ({filteredProfiles.length})</Button></div>{filteredProfiles.length === 0 ? <EmptyState filtered title="Nessun profilo corrisponde ai filtri" /> : <div className="space-y-2">{filteredProfiles.map((profile) => <label key={profile.profile.id} className="flex cursor-pointer flex-wrap items-start gap-3 rounded border p-3"><input type="checkbox" checked={Boolean(included[profile.profile.id])} onChange={() => toggleProfile(profile)} className="mt-1 h-5 w-5" /><span className="min-w-0 flex-1"><span className="block font-medium">{profile.profile.firstName} {profile.profile.lastName}</span><span className="block text-sm text-secondary">{profile.category === 'athlete' ? 'Atleta' : 'Collaboratore'} · {profile.sourceTeams.length ? profile.sourceTeams.map((team) => team.name).join(', ') : 'nessuna squadra'}</span>{profile.family.length ? <span className="block text-sm text-secondary">Familiare collegato: relazione e permessi restano invariati</span> : null}{profile.warnings.map((warning) => <span key={warning.code} className="mr-2 inline-block text-xs text-[color:var(--cs-warning)]">{warning.message}</span>)}</span><span className={`cs-badge ${included[profile.profile.id] ? 'cs-badge--success' : 'cs-badge--neutral'}`}>{included[profile.profile.id] ? 'Porta nella nuova stagione' : 'Non portare'}</span></label>)}</div>}</Card> : null}

    {!loading && step === 'assignments' ? <Card className="space-y-4"><h3 className="font-semibold">Assegnazioni target</h3><p className="text-sm text-secondary">Puoi assegnare una o più squadre target. Nessuna squadra è assegnata automaticamente se il mapping non è univoco.</p>{allProfiles.filter((profile) => included[profile.profile.id]).map((profile) => <div key={profile.profile.id} className="rounded border p-3"><div className="font-medium">{profile.profile.firstName} {profile.profile.lastName}</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{profile.targetTeams.map((team) => { const assignment = (assignments[profile.profile.id] ?? []).find((item) => item.teamId === team.id); return <div key={team.id} className="rounded bg-[color:var(--cs-surface-2)] p-2"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(assignment)} onChange={() => toggleAssignment(profile, team.id)} />{team.name} <span className="text-xs text-secondary">{team.code}</span></label>{assignment ? <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs">Ruolo<Input value={assignment.role} onChange={(event) => updateAssignment(profile.profile.id, team.id, 'role', event.target.value)} /></label>{profile.category === 'athlete' ? <label className="text-xs">Maglia<Input type="number" min="0" max="99" value={assignment.jerseyNumber ?? ''} onChange={(event) => updateAssignment(profile.profile.id, team.id, 'jerseyNumber', event.target.value)} /></label> : null}</div> : null}</div> })}</div>{(assignments[profile.profile.id] ?? []).length === 0 ? <p className="mt-2 text-sm text-[color:var(--cs-warning)]">Senza squadra: verrà mostrato un warning e il profilo può restare incluso.</p> : null}</div>)}{includedCount === 0 ? <EmptyState title="Nessun profilo incluso" description="Torna al passo Profili per includere almeno una persona o confermare l'esclusione di tutti." /> : null}</Card> : null}

    {!loading && step === 'summary' ? <Card className="space-y-5"><h3 className="font-semibold">Riepilogo e conferma</h3><div className="grid gap-3 sm:grid-cols-3"><div className="rounded border p-3"><span className="block text-sm text-secondary">Inclusi</span><strong className="text-xl">{includedCount}</strong></div><div className="rounded border p-3"><span className="block text-sm text-secondary">Esclusi</span><strong className="text-xl">{excludedCount}</strong><p className="text-xs text-secondary">Resteranno in {source.name} e non saranno iscritti a {target.name}.</p></div><div className="rounded border p-3"><span className="block text-sm text-secondary">Senza squadra</span><strong className="text-xl">{withoutTeamCount}</strong></div></div><ul className="space-y-1 text-sm">{allProfiles.filter((profile) => !included[profile.profile.id]).slice(0, 12).map((profile) => <li key={profile.profile.id}>{profile.profile.firstName} {profile.profile.lastName} — escluso</li>)}</ul><Alert variant="info">I genitori collegati derivano dalla scelta dell'atleta: profilo, account, relazione e permessi non vengono duplicati o modificati.</Alert><label className="flex items-start gap-3 rounded border p-3"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} className="mt-1 h-5 w-5" /><span>Confermo il riepilogo. Applica solo le iscrizioni e le membership target; non attivare {target.name} e non modificare {source.name}.</span></label></Card> : null}

    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={goBack} disabled={loading || step === 'season'}>Indietro</Button>{step !== 'summary' ? <Button onClick={() => void goNext()} loading={loading}>{step === 'assignments' ? 'Vai al riepilogo' : 'Continua'}</Button> : <Button onClick={() => void submitBatch()} loading={loading} disabled={!confirm}>Conferma e salva selezioni</Button>}</div>
  </section>
}
