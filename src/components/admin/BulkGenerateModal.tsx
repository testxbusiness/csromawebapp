'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import type { DocumentTemplate } from './DocumentsManager'
import TeamMemberPicker from './TeamMemberPicker'

type Member = {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  jersey_number?: number | null
  selected?: boolean
}

type Team = { id: string; name: string; code?: string | null }

export default function BulkGenerateModal({
  template, onClose, onGenerated, onPreview
}:{
  template: DocumentTemplate
  onClose: () => void
  onGenerated: () => Promise<void> | void
  onPreview?: (html: string) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)

  // Team target
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  const [members, setMembers] = useState<Member[]>([])
  const [filter, setFilter] = useState('')

  // User target (semplice): elenco profili
  const [users, setUsers] = useState<Member[]>([])
  // Eventi (partite) + campi extra per convocazione
  type EventRow = { id: string; title?: string|null; description?: string|null; start_date?: string|null; location?: string|null; gym_id?: string|null }
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [matchDatetime, setMatchDatetime] = useState<string>('')
  const [venue, setVenue] = useState<string>('')
  const [matchInfo, setMatchInfo] = useState<string>('')
  const [coachName, setCoachName] = useState<string>('')
  const [seasonName, setSeasonName] = useState<string>('')

  useEffect(() => { void bootstrap() }, [template.id])

  async function bootstrap() {
    setLoading(true)
    try {
      if (template.target_type === 'team') {
        const { data: t } = await supabase.from('teams').select('id, name, code').order('name')
        setTeams(t || [])
      } else {
        const { data: u } = await supabase.from('profiles').select('id, first_name, last_name, email').order('last_name')
        setUsers((u || []).map(x => ({ ...x, selected: false })))
      }
    } finally {
      setLoading(false)
    }
  }

  // carica i membri quando scelgo il team
  useEffect(() => {
    if (template.target_type !== 'team' || !selectedTeamId) return
    ;(async () => {
      const { data } = await supabase
        .from('team_members')
        .select('profile_id, jersey_number, profiles(id, first_name, last_name, email)')
        .eq('team_id', selectedTeamId)
      const mapped: Member[] = (data || []).map((r: any) => ({
        id: r.profiles?.id,
        first_name: r.profiles?.first_name,
        last_name: r.profiles?.last_name,
        email: r.profiles?.email,
        jersey_number: r.jersey_number,
        selected: false,
      })).filter(Boolean)
      setMembers(mapped)
    })()
  }, [template.target_type, selectedTeamId])

  // Carica eventi di tipo partita per la squadra selezionata
  useEffect(() => {
    if (template.target_type !== 'team' || !selectedTeamId) { setEvents([]); setSelectedEventId(''); return }
    (async () => {
      const { data: links } = await supabase.from('event_teams').select('event_id').eq('team_id', selectedTeamId)
      const eventIds = Array.from(new Set((links || []).map(l => l.event_id).filter(Boolean)))
      if (!eventIds.length) { setEvents([]); setSelectedEventId(''); return }
      const { data: evs } = await supabase
        .from('events')
        .select('id, title, description, start_date, location, gym_id, event_kind')
        .in('id', eventIds)
        .eq('event_kind', 'match')
        .order('start_date', { ascending: true })
      setEvents(evs || [])
      setSelectedEventId(''); setMatchDatetime(''); setVenue(''); setMatchInfo('')
    })()
  }, [template.target_type, selectedTeamId])

  // Prefill al cambio evento
  useEffect(() => {
    if (!selectedEventId) return
    const ev = events.find(e => e.id === selectedEventId)
    if (!ev) return
    if (ev.start_date) {
      try {
        const d = new Date(ev.start_date)
        setMatchDatetime(new Intl.DateTimeFormat('it-IT', { dateStyle: 'full', timeStyle: 'short' }).format(d))
      } catch { setMatchDatetime(ev.start_date) }
    }
    (async () => {
      if (ev.location && ev.location.trim()) { setVenue(ev.location.trim()); return }
      if (ev.gym_id) {
        const { data: gym } = await supabase.from('gyms').select('name').eq('id', ev.gym_id).maybeSingle()
        if (gym?.name) { setVenue(gym.name); return }
      }
      setVenue('')
    })()
    setMatchInfo(ev.description || '')
  }, [selectedEventId, events, supabase])

  const todayStr = useMemo(
    () => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date()),
    []
  )

  const isTeamListTemplate = useMemo(() => {
    if (template.target_type !== 'team') return false
    const html = (template.content_html || '').toLowerCase()
    return html.includes('{{athletes_list}}') || html.includes('{{athletes_table}}')
  }, [template])

  // Helpers (locali per autocontenimento)
  function replaceTemplateVariables(html: string, vars: Record<string, string>) {
    let result = html || ''
    for (const [key, val] of Object.entries(vars)) {
      const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(re, val ?? '')
    }
    return result
  }

  function withOptionalLogo(html: string, includeLogo?: boolean) {
    if (!includeLogo) return html
    // semplice header con logo: adatta al tuo progetto
    const block = `
      <div style="text-align:center;margin-bottom:12px">
        <img src="/images/logo_CSRoma.png" alt="Logo" style="height:56px"/>
      </div>
    `
    return block + html
  }

  function buildAthletesMarkup(list: Member[], opts?: { includeNumber?: boolean; asTable?: boolean }) {
    const chosen = list.filter(m => m.selected)
    if (opts?.asTable) {
      const rows = chosen.map(m => {
        const num = opts.includeNumber && m.jersey_number ? `#${m.jersey_number}` : ''
        const full = `${(m.last_name || '').toUpperCase()} ${m.first_name || ''}`.trim()
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #ddd">${full}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${num}</td>
        </tr>`
      }).join('')
      return `<table style="width:100%;border-collapse:collapse;margin-top:8px">
        <thead>
          <tr>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Atleta</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:center">N°</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    } else {
      const items = chosen.map(m => {
        const num = opts?.includeNumber && m.jersey_number ? ` (#${m.jersey_number})` : ''
        const full = `${(m.last_name || '').toUpperCase()} ${m.first_name || ''}`.trim()
        return `<li>${full}${num}</li>`
      }).join('')
      return `<ul style="margin:8px 0 0 18px">${items}</ul>`
    }
  }

  async function handleGenerate() {
    if (template.target_type === 'team') {
      if (!selectedTeamId) { toast.error('Seleziona una squadra'); return }

      const team = teams.find(t => t.id === selectedTeamId)
      const chosen = members.filter(m => m.selected)
      if (chosen.length === 0) { toast.error('Seleziona almeno un atleta'); return }

      // created_by richiesto dal DB
      const { data: auth } = await supabase.auth.getUser()
      const createdBy = auth?.user?.id
      if (!createdBy) { toast.error('Sessione non valida: utente non autenticato'); return }

      if (isTeamListTemplate) {
        // 1 solo documento per squadra con elenco atleti nel testo
        const asTable = (template.content_html || '').toLowerCase().includes('{{athletes_table}}')
        const listHtml = buildAthletesMarkup(chosen, { includeNumber: true, asTable })
        const vars = {
          team_name: team?.name || 'Squadra',
          today: todayStr,
          // Campi evento / contesto
          match_datetime: matchDatetime || '',
          venue: venue || '',
          match_info: matchInfo || '',
          coach_name: coachName || '',
          season_name: seasonName || '',
          // Elenchi atleti
          athletes_list: asTable ? '' : listHtml,
          athletes_table: asTable ? listHtml : '',
          athletes_count: String(chosen.length),
        }
        const html = withOptionalLogo(replaceTemplateVariables(template.content_html, vars), template.include_logo)
        onPreview?.(html)

        const { error } = await supabase.from('documents').insert({
          // campi richiesti
          name: template.name,
          title: `${template.name} - ${team?.name || ''} - ${todayStr}`,
          type: template.type || 'team_convocation',
          created_by: createdBy,
          // lookup / destinatari (duplicati per compatibilità con policy)
          template_id: template.id,
          team_id: selectedTeamId,
          target_user_id: null,
          target_team_id: selectedTeamId,
          // contenuto
          generated_content_html: html,
          status: 'generated',
          generation_date: new Date().toISOString(),
          document_type: template.type || 'team_convocation',
        } as any)
        if (error) { toast.error('Errore salvataggio documento'); return }
      } else {
        // N documenti, uno per ciascun atleta selezionato
        const { data: auth } = await supabase.auth.getUser()
        const createdBy = auth?.user?.id
        if (!createdBy) { toast.error('Sessione non valida: utente non autenticato'); return }
        for (const m of chosen) {
          const fullVars = {
            today: todayStr,
            first_name: m.first_name || '',
            last_name: m.last_name || '',
            email: m.email || '',
            // Team + evento
            team_name: team?.name || '',
            match_datetime: matchDatetime || '',
            venue: venue || '',
            match_info: matchInfo || '',
            coach_name: coachName || '',
            season_name: seasonName || '',
          }
          const html = withOptionalLogo(replaceTemplateVariables(template.content_html, fullVars), template.include_logo)
          onPreview?.(html)
          await supabase.from('documents').insert({
            name: template.name,
            title: template.name,
            type: template.type || 'team_convocation',
            created_by: createdBy,
            template_id: template.id,
            // destinatari
            profile_id: m.id,
            team_id: selectedTeamId,
            target_user_id: m.id,           // documento personale
            target_team_id: selectedTeamId, // riferimento squadra
            // contenuto
            generated_content_html: html,
            status: 'generated',
            generation_date: new Date().toISOString(),
            document_type: template.type || 'team_convocation',
          } as any)
        }
      }
    } else {
      // target user – N documenti per gli utenti selezionati
      const chosen = users.filter(u => u.selected)
      if (chosen.length === 0) { toast.error('Seleziona almeno un utente'); return }
      const { data: auth } = await supabase.auth.getUser()
      const createdBy = auth?.user?.id
      if (!createdBy) { toast.error('Sessione non valida: utente non autenticato'); return }
      for (const u of chosen) {
        const vars = {
          today: todayStr,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          email: u.email || ''
        }
        const html = withOptionalLogo(replaceTemplateVariables(template.content_html, vars), template.include_logo)
        onPreview?.(html)
        await supabase.from('documents').insert({
          name: template.name,
          title: template.name,
          type: template.type || (template.target_type === 'team' ? 'team_convocation' : 'enrollment_form'),
          created_by: createdBy,
          template_id: template.id,
          profile_id: u.id,
          target_user_id: u.id,
          target_team_id: null,
          generated_content_html: html,
          status: 'generated',
          generation_date: new Date().toISOString(),
          document_type: template.type || 'enrollment_form',
        } as any)
      }
    }

    await onGenerated()
  }

  const filteredMembers = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return members
    return members.filter(m => (m.first_name || '').toLowerCase().includes(q) || (m.last_name || '').toLowerCase().includes(q))
  }, [members, filter])

  return (
    <div className="cs-overlay" aria-hidden="false">
      <div className="cs-modal cs-modal--xl" data-state="open">
        <div className="mb-4">
          <h3 className="cs-modal__title">Generazione documenti — {template.name}</h3>
        </div>

        {loading ? (
          <div className="p-6 text-secondary">Caricamento…</div>
        ) : (
          <>
            {template.target_type === 'team' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="cs-field__label">Squadra</label>
                    <select className="cs-select" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                      <option value="">Seleziona…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="cs-field__label">Cerca atleta</label>
                    <input className="cs-input" placeholder="Cerca per nome o cognome…" value={filter} onChange={e => setFilter(e.target.value)} />
                  </div>
                </div>

                <TeamMemberPicker
                  members={filteredMembers}
                  onToggle={(id, checked) => setMembers(prev => prev.map(m => m.id === id ? { ...m, selected: checked } : m))}
                  onToggleAll={(checked) => setMembers(prev => prev.map(m => ({ ...m, selected: checked })))}
                />

                {/* Evento partita + info gara */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="cs-field__label">Evento (partita)</label>
                    <select className="cs-select" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                      <option value="">Seleziona…</option>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.start_date ? new Date(ev.start_date).toLocaleString('it-IT') : '—'}{ev.location ? ` • ${ev.location}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="cs-field__label">Data/Ora</label>
                    <input className="cs-input" value={matchDatetime} onChange={e => setMatchDatetime(e.target.value)} placeholder="venerdì 14 marzo 2025, 20:30" />
                  </div>
                  <div>
                    <label className="cs-field__label">Luogo</label>
                    <input className="cs-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Palestra / indirizzo" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="cs-field__label">Allenatore</label>
                    <input className="cs-input" value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Nome Allenatore" />
                  </div>
                  <div>
                    <label className="cs-field__label">Stagione</label>
                    <input className="cs-input" value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="2024/2025" />
                  </div>
                </div>
                <div>
                  <label className="cs-field__label">Info Gara</label>
                  <textarea className="cs-textarea" rows={3} value={matchInfo} onChange={e => setMatchInfo(e.target.value)} placeholder="Descrizione dalla scheda evento…" />
                </div>

                {isTeamListTemplate ? (
                  <p className="text-xs text-secondary">
                    Il template contiene <code>&#123;&#123;athletes_list&#125;&#125;</code> o <code>&#123;&#123;athletes_table&#125;&#125;</code>: verrà creato <b>un solo documento</b> per la squadra con elenco atleti selezionati.
                  </p>
                ) : (
                  <p className="text-xs text-secondary">
                    Verrà creato <b>un documento per ogni atleta selezionato</b>.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="cs-field__label">Seleziona Utenti</label>
                  <div className="flex gap-2">
                    <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => setUsers(prev => prev.map(u => ({ ...u, selected: true })))}>Tutti</button>
                    <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => setUsers(prev => prev.map(u => ({ ...u, selected: false })))}>Nessuno</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto cs-card p-3 space-y-1">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={!!u.selected} onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, selected: e.target.checked } : x))} />
                      <span>{(u.last_name || '').toUpperCase()} {u.first_name} <span className="text-secondary text-xs">{u.email}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="cs-btn cs-btn--outline" onClick={onClose}>Annulla</button>
          <button className="cs-btn cs-btn--ghost" onClick={() => {
            // anteprima veloce dell’HTML con placeholder minimi
            if (template.target_type === 'team') {
              const demo = withOptionalLogo(replaceTemplateVariables(template.content_html, {
                team_name: teams.find(t => t.id === selectedTeamId)?.name || 'Team Demo',
                today: todayStr,
                match_datetime: matchDatetime || 'lunedì 3 novembre 2025 alle ore 20:14',
                venue: venue || 'Palestra Demo',
                match_info: matchInfo || 'Info gara demo',
                coach_name: coachName || 'Nome Allenatore',
                season_name: seasonName || '2024/2025',
                athletes_list: '<ul><li>ROSSI MARIO</li><li>BIANCHI LUCA</li></ul>',
                athletes_table: ''
              }), template.include_logo)
              onPreview?.(demo)
            } else {
              const demo = withOptionalLogo(replaceTemplateVariables(template.content_html, {
                first_name: 'Mario', last_name: 'Rossi', email: 'mario.rossi@example.com', today: todayStr,
                match_datetime: matchDatetime || 'lunedì 3 novembre 2025 alle ore 20:14',
                venue: venue || 'Palestra Demo',
                match_info: matchInfo || 'Info gara demo',
                coach_name: coachName || 'Nome Allenatore',
                season_name: seasonName || '2024/2025'
              }), template.include_logo)
              onPreview?.(demo)
            }
          }}>
            Anteprima
          </button>
          <button className="cs-btn cs-btn--primary" onClick={handleGenerate}>Genera</button>
        </div>
      </div>
    </div>
  )
}
