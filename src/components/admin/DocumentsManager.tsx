'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generatePDF, downloadPDF } from '@/lib/utils/pdfGenerator'


/** ================================================================
 *  TIPI MINIMI (adatta se nel tuo progetto già esistono i types)
 *  ================================================================ */
type TargetType = 'user' | 'team'

type DocumentTemplate = {
  id: string
  name: string
  description?: string | null
  type?: 'medical_certificate_request' | 'enrollment_form' | 'attendance_certificate' | 'payment_receipt' | 'team_convocation'
  target_type: TargetType
  content_html: string
  styles_css?: string | null
  has_logo?: boolean | null
  logo_position?: 'top-left' | 'top-center' | 'top-right' | null
  created_at?: string
  updated_at?: string
}

type GeneratedDocument = {
  id: string
  template_id?: string | null
  title: string
  generated_content_html?: string | null
  target_user_id?: string | null
  target_team_id?: string | null
  created_at?: string
}

type Team = { id: string; name: string; code?: string | null }
type TeamMember = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  jersey_number?: string | null
  selected?: boolean
}

/** ================================================================
 *  UTILS: PDF (usa dinamico per non rompere se non esiste la lib)
 *  ================================================================ */
async function generatePDFSafe(opts: any): Promise<Uint8Array | Blob | null> {
  try { return await generatePDF(opts) } catch { alert('Errore generazione PDF'); return null }
}
async function downloadPDFSafe(pdf: Uint8Array | Blob | null, filename: string) {
  if (!pdf) return
  try { return downloadPDF(pdf) } catch { /* fallback non necessario: usa util ufficiale */ }
}

/** ================================================================
 *  HELPER: Variabili → HTML
 *  (Sostituisce {{first_name}} ecc. ; adatta alla tua sintassi)
 *  ================================================================ */
function replaceTemplateVariables(html: string, variables: Record<string, any>) {
  let out = html
  Object.entries(variables).forEach(([key, value]) => {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    out = out.replace(re, value ?? '')
  })
  return out
}

/** ================================================================
 *  HELPER: Logo opzionale inserito in alto
 *  ================================================================ */
function withOptionalLogo(baseHtml: string, t: DocumentTemplate) {
  if (!t?.has_logo) return baseHtml
  // Richiesta: il logo va sempre in alto al centro
  const block = `
    <div style="text-align:center; margin-bottom:16px">
      <img src="/images/logo_CSRoma.png" alt="CSRoma" style="height:80px; object-fit:contain"/>
    </div>
  `
  return `${block}${baseHtml}`
}

/** ================================================================
 *  COMPONENTE PRINCIPALE
 *  ================================================================ */
export default function DocumentsManager() {
  const supabase = createClient()

  // Stato dati
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)

  // Preview
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>('')

  // Modal bulk generation
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [bulkRecipients, setBulkRecipients] = useState<any[]>([]) // utenti o squadre, caricati all’apertura
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set()) // per target user
  const [selectedTeamId, setSelectedTeamId] = useState<string>('') // per target team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])          // membri di squadra selezionabili
  // Modal nuovo template
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState<Partial<DocumentTemplate>>({
    name: '',
    description: '',
    type: 'team_convocation',
    target_type: 'team',
    content_html: '<h1>{{team_name}}</h1><p>Convocazione per oggi alle 18:00.</p>',
    has_logo: true,
  })

 // Caricamento iniziale
const loadAll = useCallback(async () => {
  setLoading(true)
  try {
    const [
      { data: templates, error: tErr },
      { data: documents, error: dErr }
    ] = await Promise.all([
      supabase
        .from('document_templates')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('documents') // <-- usa il nome della tua tabella
        .select('id,title,template_id,generated_content_html,target_user_id,target_team_id,created_at')
        .order('created_at', { ascending: false })
    ])

    if (tErr) throw tErr
    if (dErr) throw dErr

    setTemplates(templates ?? [])
    setDocuments(documents ?? [])
  } catch (err) {
    console.error('Errore caricamento documenti/templates:', err)
    setTemplates([])
    setDocuments([])
  } finally {
    setLoading(false)
  }
}, [supabase])

  // Caricamento iniziale
  useEffect(() => {
    loadAll()
  }, [loadAll])

  /** =======================
   * Anteprima template (HTML)
   * ======================= */
  const previewTemplate = async (template: DocumentTemplate) => {
    try {
      // variabili di esempio per anteprima
      const variables = {
        first_name: 'Mario',
        last_name: 'Rossi',
        team_name: 'CSRoma U15',
        today: new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date()),
      }
      let html = replaceTemplateVariables(template.content_html, variables)
      html = withOptionalLogo(html, template)
      setPreviewContent(html)
      setShowPreview(true)
    } catch (e) {
      console.error('Errore anteprima:', e)
      alert('Impossibile generare anteprima')
    }
  }

  /** =======================
   * Eliminazione Template
   * ======================= */
  const deleteTemplate = async (id: string) => {
    if (!confirm('Eliminare il template?')) return
    const { error } = await supabase.from('document_templates').delete().eq('id', id)
    if (error) { alert('Errore eliminazione template'); return }
    await loadAll()
  }

  /** =======================
   * Eliminazione Documento
   * ======================= */
  const deleteDocument = async (id: string) => {
    if (!confirm('Eliminare il documento?')) return
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) { alert('Errore eliminazione documento'); return }
    await loadAll()
  }

  /** ============================================================
   *  BULK GENERATION – apertura modal + caricamento recipients
   * ============================================================ */
  const startBulkGeneration = async (template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setShowBulkModal(true)
    setSelectedUsers(new Set())
    setSelectedTeamId('')
    setTeamMembers([])

    try {
      if (template.target_type === 'user') {
        // carica utenti (solo i necessari in elenco)
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .order('last_name', { ascending: true })
        setBulkRecipients(data || [])
      } else {
        // carica squadre
        const { data } = await supabase
          .from('teams')
          .select('id, name, code')
          .order('name', { ascending: true })
        setBulkRecipients(data || [])
      }
    } catch (e) {
      console.error('Errore carico destinatari bulk:', e)
      setBulkRecipients([])
    }
  }

  /** ============================================================
   *  BULK GENERATION – carica membri squadra
   * ============================================================ */
  const loadTeamMembers = useCallback(async (teamId: string) => {
    if (!teamId) { setTeamMembers([]); return }
    try {
      const { data } = await supabase
        .from('team_members')
        .select('profiles(id, first_name, last_name, email), jersey_number')
        .eq('team_id', teamId)

      const mapped = (data || []).map((r: any) => ({
        id: r.profiles?.id,
        first_name: r.profiles?.first_name,
        last_name: r.profiles?.last_name,
        email: r.profiles?.email,
        jersey_number: r.jersey_number ?? null,
        selected: true, // default “selezionati tutti”
      } as TeamMember)).filter(m => !!m.id)

      setTeamMembers(mapped)
    } catch (e) {
      console.error('Errore carico membri squadra:', e)
      setTeamMembers([])
    }
  }, [supabase])

  /** ============================================================
   *  BULK GENERATION – genera N documenti (utenti o membri squadra)
   * ============================================================ */
  const generateBulkPDFs = async (recipients: { id: string; first_name?: string; last_name?: string; email?: string }[]) => {
    if (!selectedTemplate) return
    try {
      for (const r of recipients) {
        const variables = {
          first_name: r.first_name ?? '',
          last_name: r.last_name ?? '',
          email: r.email ?? '',
          today: new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date()),
        }
        const baseHtml = replaceTemplateVariables(selectedTemplate.content_html, variables)
        const finalHtml = withOptionalLogo(baseHtml, selectedTemplate)

        const { error } = await supabase.from('documents').insert({
          title: selectedTemplate.name,
          template_id: selectedTemplate.id,
          target_user_id: selectedTemplate.target_type === 'user' ? r.id : null,
          target_team_id: selectedTemplate.target_type === 'team' ? selectedTeamId || null : null,
          generated_content_html: finalHtml,
          status: 'generated',
          generation_date: new Date().toISOString(),
          document_type: 'team_convocation',
        } as any)
        if (error) console.warn('Documento non salvato per', r.id)
      }
      alert(`Creati ${recipients.length} documenti`)
      setShowBulkModal(false)
      setSelectedTemplate(null)
      await loadAll()
    } catch (e) {
      console.error('Errore bulk generation:', e)
      alert('Errore nella generazione multipla')
    }
  }

  /** ============================================================
   *  DOCUMENT → Scarica PDF
   * ============================================================ */
  const downloadDocumentPDF = async (doc: GeneratedDocument) => {
    if (!doc.generated_content_html) return alert('Documento non generato.')
    const pdf = await generatePDF({
      title: doc.title,
      content: doc.generated_content_html,
    })
    downloadPDF(pdf)
  }

  /** ============================================================
   *  DOCUMENT → invia come messaggio con allegato PDF
   * ============================================================ */
  const sendDocumentAsMessage = async (doc: GeneratedDocument) => {
    try {
      if (!doc.generated_content_html) return alert('Documento non generato.')

      // 1) genera PDF (client) e crea File
      const pdf = await generatePDF({ title: doc.title, content: doc.generated_content_html })
      const blob = pdf.blob
      const fileName = pdf.filename.endsWith('.pdf') ? pdf.filename : `${doc.title.replace(/\s+/g, '_')}.pdf`

      // 2) upload allegato
      const form = new FormData()
      form.append('files', new File([blob], fileName, { type: blob.type || 'application/pdf' }))
      const uploadRes = await fetch('/api/messages/attachments/upload', { method: 'POST', body: form })
      if (!uploadRes.ok) throw new Error('Upload allegato fallito')
      const uploadData = await uploadRes.json()
      const attachments = (uploadData.files || []).map((f: any) => ({
        file_path: f.file_path,
        file_name: f.file_name,
        mime_type: f.mime_type,
        file_size: f.file_size,
      }))

      // 3) calcola destinatari
      let selected_users: string[] = []
      let selected_teams: string[] = []
      if (doc.target_user_id) {
        selected_users = [doc.target_user_id]
      } else if (doc.target_team_id) {
        const { data: members } = await supabase
          .from('team_members')
          .select('profile_id')
          .eq('team_id', doc.target_team_id)
        selected_users = (members || []).map((m: any) => m.profile_id)
      }
      if (selected_users.length === 0 && selected_teams.length === 0) return alert('Nessun destinatario trovato.')

      // 4) crea messaggio admin con allegato
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: doc.title,
          content: 'In allegato trovi il documento generato.',
          selected_users,
          selected_teams,
          attachments,
          channels: ['app'], // adatta se vuoi anche email
        }),
      })
      if (!res.ok) throw new Error('Invio messaggio fallito')
      alert('Messaggio inviato con successo!')
    } catch (e) {
      console.error(e)
      alert('Errore durante l’invio del messaggio')
    }
  }

  /** ============================================================
   *  RENDER
   * ============================================================ */
  if (loading) {
    return (
      <div className="cs-card p-6">
        <div className="cs-skeleton h-8 w-1/3 mb-3"></div>
        <div className="cs-skeleton h-5 w-1/2"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* TEMPLATES */}
      <section className="cs-card cs-card--primary">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Template</h2>
            <div className="flex gap-2">
              <button className="cs-btn cs-btn--primary" onClick={() => setShowCreateTemplate(true)}>Nuovo Template</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="cs-table">
            <thead>
              <tr>
                <th className="p-4 text-left text-sm font-medium">Nome</th>
                <th className="p-4 text-left text-sm font-medium">Target</th>
                <th className="p-4 text-left text-sm font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td className="p-4">
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-sm text-secondary">{t.description}</div>}
                  </td>
                  <td className="p-4 text-sm">{t.target_type === 'team' ? 'Squadra' : 'Utente'}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="cs-btn cs-btn--outline cs-btn--sm"
                        onClick={() => previewTemplate(t)}
                      >
                        Anteprima
                      </button>
                      <a
                        href={`/admin/documents/templates/${t.id}`}
                        className="cs-btn cs-btn--outline cs-btn--sm"
                      >
                        Modifica
                      </a>
                      <button
                        className="cs-btn cs-btn--outline cs-btn--sm"
                        onClick={() => startBulkGeneration(t)}
                      >
                        Genera in serie
                      </button>
                      <button className="cs-btn cs-btn--danger cs-btn--sm" onClick={() => deleteTemplate(t.id)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td className="p-6 text-secondary" colSpan={4}>Nessun template creato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL: Nuovo Template */}
      {showCreateTemplate && (
        <div className="cs-overlay" aria-hidden="false" onClick={() => setShowCreateTemplate(false)}>
          <div className="cs-modal cs-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="cs-modal__header">
              <div className="cs-modal__icon">🧩</div>
              <div>
                <div className="cs-modal__title">Nuovo Template</div>
                <div className="cs-modal__description">Crea un modello per utenti o squadre.</div>
              </div>
            </div>

            <div className="cs-grid" style={{ gap: 12 }}>
              <div className="cs-field">
                <label className="cs-field__label">Nome *</label>
                <input className="cs-input" value={templateForm.name || ''} onChange={(e)=>setTemplateForm(p=>({...p, name:e.target.value}))} />
              </div>

              <div className="cs-field">
                <label className="cs-field__label">Descrizione</label>
                <textarea className="cs-textarea" rows={2} value={templateForm.description || ''} onChange={(e)=>setTemplateForm(p=>({...p, description:e.target.value}))} />
              </div>

              <div className="cs-grid cs-grid--2" style={{ gap: 12 }}>
                <div className="cs-field">
                  <label className="cs-field__label">Tipo *</label>
                  <select className="cs-select" value={templateForm.type || 'team_convocation'} onChange={(e)=>setTemplateForm(p=>({...p, type: e.target.value as any}))}>
                    <option value="medical_certificate_request">Richiesta Certificato Medico</option>
                    <option value="enrollment_form">Modulo Iscrizione</option>
                    <option value="attendance_certificate">Attestato Frequenza</option>
                    <option value="payment_receipt">Ricevuta Pagamento</option>
                    <option value="team_convocation">Convocazione Squadra</option>
                  </select>
                </div>
                <div className="cs-field">
                  <label className="cs-field__label">Target *</label>
                  <select className="cs-select" value={templateForm.target_type || 'team'} onChange={(e)=>setTemplateForm(p=>({...p, target_type: e.target.value as TargetType}))}>
                    <option value="user">Utente</option>
                    <option value="team">Squadra</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!templateForm.has_logo} onChange={(e)=>setTemplateForm(p=>({...p, has_logo: e.target.checked}))} />
                <span>Includi logo (centrato)</span>
              </label>

              <div className="cs-field">
                <label className="cs-field__label">Contenuto HTML *</label>
                <textarea className="cs-textarea font-mono text-sm" rows={8} value={templateForm.content_html || ''} onChange={(e)=>setTemplateForm(p=>({...p, content_html: e.target.value}))} />
                <p className="cs-help">
                  Usa {'{{first_name}}'}, {'{{last_name}}'}, {'{{team_name}}'}, {'{{today}}'} come variabili esempio.
                </p>
              </div>
            </div>

            <div className="cs-modal__footer">
              <button className="cs-btn cs-btn--outline" onClick={()=>setShowCreateTemplate(false)}>Annulla</button>
              <button
                className="cs-btn cs-btn--primary"
                disabled={savingTemplate || !templateForm.name || !templateForm.content_html || !templateForm.type}
                onClick={async ()=>{
                  setSavingTemplate(true)
                  try{
                    const { error } = await supabase.from('document_templates').insert({
                      name: templateForm.name,
                      description: templateForm.description || null,
                      type: templateForm.type!,
                      target_type: templateForm.target_type || 'team',
                      content_html: templateForm.content_html!,
                      styles_css: null,
                      has_logo: !!templateForm.has_logo,
                      logo_position: 'top-center',
                      has_date: true,
                      date_format: 'dd/mm/yyyy',
                      has_signature_area: true,
                      footer_text: null,
                      is_active: true,
                    } as any)
                    if (error) { alert('Errore salvataggio template'); return }
                    setShowCreateTemplate(false)
                    await loadAll()
                  } finally {
                    setSavingTemplate(false)
                  }
                }}
              >
                Salva Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTI GENERATI */}
      <section className="cs-card cs-card--primary">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Documenti generati</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="cs-table">
            <thead>
              <tr>
                <th className="p-4 text-left text-sm font-medium">Titolo</th>
                <th className="p-4 text-left text-sm font-medium">Creato il</th>
                <th className="p-4 text-left text-sm font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td className="p-4">
                    <div className="font-medium">{doc.title}</div>
                    {doc.template_id && (
                      <div className="text-xs text-secondary">Template: {doc.template_id}</div>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString('it-IT')
                      : '—'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {doc.generated_content_html && (
                        <>
                          <button
                            className="cs-btn cs-btn--outline cs-btn--sm"
                            onClick={() => {
                              setPreviewContent(doc.generated_content_html!)
                              setShowPreview(true)
                            }}
                          >
                            Visualizza
                          </button>
                          <button
                            className="cs-btn cs-btn--outline cs-btn--sm"
                            onClick={() => downloadDocumentPDF(doc)}
                          >
                            Scarica PDF
                          </button>
                          <button
                            className="cs-btn cs-btn--primary cs-btn--sm"
                            onClick={() => sendDocumentAsMessage(doc)}
                          >
                            Invia come messaggio
                          </button>
                        </>
                      )}
                      <button
                        className="cs-btn cs-btn--danger cs-btn--sm"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr><td className="p-6 text-secondary" colSpan={3}>Nessun documento generato.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL: Anteprima HTML */}
      {showPreview && (
        <div className="cs-overlay" aria-hidden="false" onClick={() => setShowPreview(false)}>
          <div className="cs-modal cs-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="cs-modal__header">
              <div className="cs-modal__icon">📄</div>
              <div>
                <div className="cs-modal__title">Anteprima documento</div>
                <div className="cs-modal__description">Questa è un’anteprima HTML.</div>
              </div>
            </div>
            <div style={{ border: '1px solid var(--cs-border)', borderRadius: 12, padding: 12, maxHeight: '60vh', overflow: 'auto' }}
                 dangerouslySetInnerHTML={{ __html: previewContent }} />
            <div className="cs-modal__footer">
              <button className="cs-btn cs-btn--outline" onClick={() => setShowPreview(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Generazione in serie */}
      {showBulkModal && selectedTemplate && (
        <div className="cs-overlay" aria-hidden="false" onClick={() => setShowBulkModal(false)}>
          <div className="cs-modal cs-modal--lg" onClick={(e) => e.stopPropagation()}>
            <div className="cs-modal__header">
              <div className="cs-modal__icon">🧾</div>
              <div>
                <div className="cs-modal__title">Genera in serie: {selectedTemplate.name}</div>
                <div className="cs-modal__description">
                  {selectedTemplate.target_type === 'user'
                    ? 'Seleziona gli utenti destinatari'
                    : 'Seleziona squadra e membri convocati'}
                </div>
              </div>
            </div>

            {selectedTemplate.target_type === 'user' ? (
              <div className="cs-card" style={{ maxHeight: '50vh', overflow: 'auto' }}>
                {bulkRecipients.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(u.id)}
                      onChange={(e) => {
                        const n = new Set(selectedUsers)
                        if (e.target.checked) n.add(u.id); else n.delete(u.id)
                        setSelectedUsers(n)
                      }}
                    />
                    <span className="text-sm">
                      {u.first_name} {u.last_name} — <span className="text-secondary">{u.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="cs-field">
                  <label className="cs-field__label">Seleziona Squadra</label>
                  <select
                    className="cs-select"
                    value={selectedTeamId}
                    onChange={async (e) => {
                      const v = e.target.value
                      setSelectedTeamId(v)
                      await loadTeamMembers(v)
                    }}
                  >
                    <option value="">—</option>
                    {bulkRecipients.map((t: Team) => (
                      <option key={t.id} value={t.id}>{t.name} {t.code ? `(${t.code})` : ''}</option>
                    ))}
                  </select>
                </div>

                {selectedTeamId && (
                  <div className="cs-card" style={{ maxHeight: '45vh', overflow: 'auto' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Membri squadra</div>
                      <div className="flex gap-2">
                        <button
                          className="cs-btn cs-btn--ghost cs-btn--sm"
                          onClick={() => setTeamMembers(prev => prev.map(m => ({ ...m, selected: true })))}
                        >Seleziona tutti</button>
                        <button
                          className="cs-btn cs-btn--ghost cs-btn--sm"
                          onClick={() => setTeamMembers(prev => prev.map(m => ({ ...m, selected: false })))}
                        >Deseleziona tutti</button>
                      </div>
                    </div>
                    <div className="cs-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
                      {teamMembers.map((m, idx) => (
                        <label key={m.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!m.selected}
                            onChange={(e) => {
                              const next = [...teamMembers]
                              next[idx] = { ...m, selected: e.target.checked }
                              setTeamMembers(next)
                            }}
                          />
                          <span className="text-sm">
                            {m.first_name} {m.last_name}
                            {m.jersey_number ? ` (#${m.jersey_number})` : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="cs-modal__footer">
              <button className="cs-btn cs-btn--outline" onClick={() => setShowBulkModal(false)}>Annulla</button>
              {selectedTemplate.target_type === 'user' ? (
                <button
                  className="cs-btn cs-btn--primary"
                  disabled={selectedUsers.size === 0}
                  onClick={() => {
                    const chosen = bulkRecipients.filter((u: any) => selectedUsers.has(u.id))
                    generateBulkPDFs(chosen)
                  }}
                >
                  Genera {selectedUsers.size} documenti
                </button>
              ) : (
                <button
                  className="cs-btn cs-btn--primary"
                  disabled={!selectedTeamId || teamMembers.every(m => !m.selected)}
                  onClick={() => {
                    const chosen = teamMembers.filter(m => m.selected).map(m => ({
                      id: m.id!,
                      first_name: m.first_name,
                      last_name: m.last_name,
                      email: m.email,
                    }))
                    generateBulkPDFs(chosen)
                  }}
                >
                  Genera {teamMembers.filter(m => m.selected).length} documenti
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
