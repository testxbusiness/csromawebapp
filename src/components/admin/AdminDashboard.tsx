'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardTitle, CardMeta, Stat } from '@/components/ui'
import { List, ListItem } from '@/components/ui/List'
import { Badge } from '@/components/ui/Badge'

interface AdminProfile {
  first_name?: string | null
  role?: string | null
}

interface AdminDashboardProps {
  profile: AdminProfile
}

interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  const [isFirstAccess, setIsFirstAccess] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [lastSignIn, setLastSignIn] = useState<string>('—')
  const [metrics, setMetrics] = useState({ activities: 0, teams: 0, athletes: 0, coaches: 0 })
  const supabase = createClient()

  const checkFirstAccess = useCallback(async () => {
    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('id')
      .limit(1)

    setIsFirstAccess(!seasonsData || seasonsData.length === 0)
  }, [supabase])

  const loadSeasons = useCallback(async () => {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false })

    setSeasons(data || [])
    setLoading(false)
  }, [supabase])

  // Carica tutti i dati iniziali in un unico effetto
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        checkFirstAccess(),
        loadSeasons()
      ])

      // Ultimo accesso dall'utente corrente
      const { data } = await supabase.auth.getUser()
      const iso = (data.user as any)?.last_sign_in_at
      if (!iso) { setLastSignIn('Oggi'); return }
      try {
        const d = new Date(iso)
        setLastSignIn(new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(d))
      } catch { setLastSignIn('Oggi') }
    }

    loadInitialData()
  }, []) // Dipendenze vuote - carica solo al mount

  // Carica stagione attiva e calcola metriche dipendenti
  useEffect(() => {
    const run = async () => {
      const { data: act } = await supabase
        .from('seasons')
        .select('id, name, start_date, end_date, is_active')
        .eq('is_active', true)
        .maybeSingle()
      setActiveSeason(act || null)

      if (!act) { setMetrics({ activities: 0, teams: 0, athletes: 0, coaches: 0 }); return }

      // Attività della stagione
      const { data: acts } = await supabase
        .from('activities')
        .select('id')
        .eq('season_id', act.id)
      const activityIds = (acts || []).map(a => a.id)

      // Squadre collegate alle attività
      let teamIds: string[] = []
      if (activityIds.length) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .in('activity_id', activityIds)
        teamIds = (teams || []).map(t => t.id)
      }

      // Iscritti (atleti) = distinct profili nei team_members
      let athletes = 0
      if (teamIds.length) {
        const { data: members } = await supabase
          .from('team_members')
          .select('profile_id, team_id')
          .in('team_id', teamIds)
        const uniq = new Set((members || []).map(m => m.profile_id))
        athletes = uniq.size
      }

      // Collaboratori (coach) = distinct coach_id su team_coaches
      let coaches = 0
      if (teamIds.length) {
        const { data: tc } = await supabase
          .from('team_coaches')
          .select('coach_id, team_id')
          .in('team_id', teamIds)
        const uniqC = new Set((tc || []).map(r => r.coach_id))
        coaches = uniqC.size
      }

      setMetrics({
        activities: activityIds.length,
        teams: teamIds.length,
        athletes,
        coaches,
      })
    }
    run()
  }, [supabase])

  const handleCreateFirstSeason = useCallback(async () => {
    const currentYear = new Date().getFullYear()
    const { error } = await supabase
      .from('seasons')
      .insert([{
        name: `Stagione ${currentYear}/${currentYear + 1}`,
        start_date: new Date(currentYear, 8, 1).toISOString(),
        end_date: new Date(currentYear + 1, 5, 30).toISOString(),
        is_active: true
      }])
      .select()

    if (!error) {
      setIsFirstAccess(false)
      loadSeasons()
    }
  }, [loadSeasons, supabase])

  if (loading) return <div className="cs-card" style={{ padding: 24 }}>Caricamento dashboard…</div>

  if (isFirstAccess) {
    return (
      <Card>
        <CardTitle>Benvenuto in CSRoma, {profile.first_name ?? 'amministratore'}!</CardTitle>
        <CardMeta>È il tuo primo accesso: crea la stagione iniziale per attivare la gestione di squadre, attività e calendari.</CardMeta>
        <div className="cs-list" style={{ marginTop: 12 }}>
          <div className="cs-list-item">• Creiamo una stagione per l&apos;anno corrente (settembre → giugno)</div>
          <div className="cs-list-item">• La imposteremo come attiva per collegare attività e squadre</div>
          <div className="cs-list-item">• Potrai modificarla o archiviarla in qualsiasi momento</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={handleCreateFirstSeason}>Crea la prima stagione</Button>
        </div>
      </Card>
    )
  }

  const activeSeasons = seasons.filter((season) => season.is_active).length

  return (
    <div className="space-y-8">
      {/* Messaggio di benvenuto */}
      <Card variant='primary'>
        <CardTitle>Benvenuto in CSRoma</CardTitle>
        <CardMeta>
          Ciao {`${profile.first_name ?? ''}`.trim() || 'utente'}, gestisci la tua società con un colpo d&apos;occhio.
        </CardMeta>
      </Card>

      {/* Ruolo / Ultimo accesso */}
      <Card variant='primary'>
        <div className="cs-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <CardMeta>Ruolo</CardMeta>
            <CardTitle>{profile.role?.toUpperCase?.() ?? 'ADMIN'}</CardTitle>
          </div>
          <div>
            <CardMeta>Ultimo accesso</CardMeta>
            <CardTitle>{lastSignIn}</CardTitle>
          </div>
        </div>
      </Card>

      {/* KPI primaria */}
      <div className="cs-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <Stat label="Stagioni attive" value={String(activeSeasons)} description="Configurate per attività e squadre" variant="primary" />
        <Stat label="Le Attività" value={String(metrics.activities)} description={activeSeason ? `Attività stagione ${activeSeason.name}` : 'Nessuna stagione attiva'} variant="primary" />
        <Stat label="Le Squadre" value={String(metrics.teams)} description="Squadre nella stagione attiva" variant="primary" />
      </div>
      <div className="cs-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <Stat label="Iscritti" value={String(metrics.athletes)} description="Atleti nella stagione attiva" variant="primary" />
        <Stat label="Collaboratori" value={String(metrics.coaches)} description="Coach nella stagione attiva" variant="primary" />
      </div>

      <div className="cs-grid cs-grid--2-1">
        <Card variant='primary'>
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
            <div>
              <CardTitle>Stagioni recenti</CardTitle>
              <CardMeta>Gestione rapida delle ultime stagioni create.</CardMeta>
            </div>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/admin/seasons')}>
              Apri gestione stagioni →
            </Button>
          </div>

          {seasons.length > 0 ? (
            <List>
              {seasons.slice(0, 4).map((season) => (
                <ListItem
                  key={season.id}
                  title={season.name}
                  description={formatDateRange(season.start_date, season.end_date)}
                  actions={<Badge variant={season.is_active ? 'success' : 'neutral'}>{season.is_active ? 'Attiva' : 'Archiviata'}</Badge>}
                />
              ))}
            </List>
          ) : (
            <div className="text-secondary" style={{ padding: 12 }}>Nessuna stagione creata.</div>
          )}
        </Card>

        <Card variant='primary'>
          <CardTitle>Checklist rapida</CardTitle>
          <CardMeta>Aggiorna le aree principali prima di comunicare con i team.</CardMeta>
          <List>
            <ListItem title={<a href="/admin/activities">Assegna attività alle squadre →</a>} />
            <ListItem title={<a href="/admin/messages">Invia comunicazione ai coach →</a>} />
            <ListItem title={<a href="/admin/users">Controlla scadenze certificati →</a>} />
            <ListItem title={<a href="/admin/membership-fees">Aggiorna quote associative →</a>} />
          </List>
        </Card>
      </div>
    </div>
  )
}

function formatDateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' })
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`
}
