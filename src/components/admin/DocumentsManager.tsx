'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TemplateModal from './TemplateModal'
import BulkGenerateModal from './BulkGenerateModal'
import PreviewModal from './PreviewModal'
import TemplateVariablesHelp from './TemplateVariablesHelp'
import MessageModal from './MessageModal'
import { generatePDF, savePDFToStorage } from '@/lib/utils/pdfGenerator'

type TargetType = 'user' | 'team'

export interface DocumentTemplate {
  id: string
  name: string
  target_type: TargetType
  content_html: string
  // Manteniamo include_logo per compatibilità con i modali già creati;
  // lo popoliamo leggendo dal campo reale has_logo (se presente in DB).
  include_logo?: boolean
  type?: string | null
  created_at?: string | null
  updated_at?: string | null
  // campi addizionali possibili nel tuo schema (non usati direttamente qui)
  description?: string | null
}

export default function DocumentsManager() {
  const supabase = createClient()

  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Documenti generati
  type DocumentRow = {
    id: string
    template_id: string | null
    title: string
    status: 'draft' | 'generated' | 'sent' | 'archived'
    generated_content_html: string | null
    file_url: string | null
    file_name: string | null
    target_user_id: string | null
    target_team_id: string | null
    created_at?: string | null
    updated_at?: string | null
  }
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  // Messaggistica (allega allegato)
  type Team = { id: string; name: string; code: string }
  type User = { id: string; first_name: string; last_name: string; role: string }
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageDraft, setMessageDraft] = useState<any | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      // Prendiamo tutto senza ORDER per evitare errori su colonne non esposte,
      // poi ordiniamo lato client.
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')

      if (error) {
        console.error('Errore caricamento template:', error)
        setTemplates([])
        return
      }

      const normalized = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        target_type: row.target_type as TargetType,
        // Read content from either `content_html` or legacy/new `content`
        content_html: row.content_html || row.content || '',
        include_logo: typeof row.has_logo === 'boolean' ? row.has_logo : !!row.include_logo,
        type: row.type ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        description: row.description ?? null,
      })) as DocumentTemplate[]

      const ordered = normalized.sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at || 0).getTime()
        const bT = new Date(b.updated_at || b.created_at || 0).getTime()
        return bT - aT
      })

      setTemplates(ordered)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void loadTemplates() }, [loadTemplates])
  useEffect(() => { void loadDocuments() }, [])
  useEffect(() => { void bootstrapMessagingLookups() }, [])

  async function loadDocuments() {
    setLoadingDocs(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .in('status', ['draft', 'generated'])
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) {
        console.error('Errore caricamento documenti:', error)
        setDocuments([])
        return
      }
      setDocuments((data || []) as any)
    } finally {
      setLoadingDocs(false)
    }
  }

  async function bootstrapMessagingLookups() {
    const [{ data: t }, { data: u }] = await Promise.all([
      supabase.from('teams').select('id, name, code').order('name'),
      supabase.from('profiles').select('id, first_name, last_name, role').order('first_name'),
    ])
    setTeams(t || [])
    setUsers(u || [])
  }

  const onCreateTemplate = () => {
    setEditingTemplate(null)
    setShowTemplateModal(true)
  }

  const onEditTemplate = (t: DocumentTemplate) => {
    setEditingTemplate(t)
    setShowTemplateModal(true)
  }

  const onBulkGenerate = (t: DocumentTemplate) => {
    setSelectedTemplate(t)
    setShowBulkModal(true)
  }

  async function handleCreatePdf(doc: DocumentRow) {
    if (!doc.generated_content_html) { alert('Contenuto non disponibile'); return }
    try {
      // Genera PDF lato client evitando header duplicati
      const pdf = await generatePDF({
        title: doc.title,
        content: doc.generated_content_html,
        hasLogo: false,
        hasDate: false,
        hasSignatureArea: false,
      })
      const url = await savePDFToStorage(supabase, pdf, 'documents')
      if (!url) { alert('Errore salvataggio PDF'); return }
      const { error } = await supabase
        .from('documents')
        .update({ file_url: url, file_name: pdf.filename })
        .eq('id', doc.id)
      if (error) { console.error(error); alert('Errore aggiornamento documento'); return }
      await loadDocuments()
    } catch (e) {
      console.error('PDF gen error:', e)
      alert('Errore nella generazione del PDF')
    }
  }

  async function handleDownloadPdf(doc: DocumentRow) {
    // Preferisci URL firmato: il bucket potrebbe essere privato
    if (doc.file_name) {
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(`generated/${doc.file_name}`, 60) // valido 60s
        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, '_blank')
          return
        }
      } catch (e) {
        console.error('Signed URL error:', e)
      }
    }
    // Fallback a URL pubblico eventualmente salvato
    if (doc.file_url) window.open(doc.file_url, '_blank')
    else alert('File non disponibile per il download')
  }

  function handlePreviewHtml(doc: DocumentRow) {
    if (doc.generated_content_html) setPreviewHtml(doc.generated_content_html)
  }

  function handleAttachToMessage(doc: DocumentRow) {
    if (!doc.file_url) { alert('Genera il PDF prima di allegarlo'); return }
    // Precompila bozza con allegato URL
    setMessageDraft({ subject: doc.title, content: '', attachment_url: doc.file_url })
    setShowMessageModal(true)
  }

  async function handleCreateMessage(payload: any) {
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Errore invio messaggio'); return }
      alert('Messaggio creato con successo')
      setShowMessageModal(false)
      setMessageDraft(null)
    } catch (e) {
      console.error(e)
      alert('Errore di rete durante l\'invio messaggio')
    }
  }

  async function handleUpdateMessage(id: string, payload: any) {
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Errore aggiornamento messaggio'); return }
      alert('Messaggio aggiornato con successo')
      setShowMessageModal(false)
      setMessageDraft(null)
    } catch (e) {
      console.error(e)
      alert('Errore di rete durante l\'aggiornamento messaggio')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Documenti & Template</h2>
          <p className="text-secondary">Crea template e genera documenti dinamici (es. Convocazioni).</p>
        </div>
        <div className="flex gap-2">
          <button className="cs-btn cs-btn--primary" onClick={onCreateTemplate}>Nuovo template</button>
        </div>
      </div>

      {/* Lista Template */}
      <div className="cs-card cs-card--primary">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Template</h3>
          {!loading && <span className="text-xs text-secondary">{templates.length} elementi</span>}
        </div>

        {loading ? (
          <div className="p-6 text-secondary">Caricamento…</div>
        ) : templates.length === 0 ? (
          <div className="p-6 text-secondary">Nessun template creato.</div>
        ) : (
          <div className="cs-list">
            {templates.map((t) => (
              <div key={t.id} className="cs-list-item">
                <div className="flex-1">
                  <div className="font-medium">
                    {t.name} <span className="text-xs text-secondary">({t.target_type})</span>
                  </div>
                  <div className="text-xs text-secondary mt-1">
                    {t.include_logo ? 'Con logo' : 'Senza logo'}{t.type ? ` • ${t.type}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="cs-btn cs-btn--outline cs-btn--sm"
                    onClick={() => onEditTemplate(t)}
                  >
                    Modifica
                  </button>
                  <button
                    className="cs-btn cs-btn--accent cs-btn--sm"
                    onClick={() => onBulkGenerate(t)}
                  >
                    Genera…
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documenti generati */}
      <div className="cs-card cs-card--primary">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Documenti generati</h3>
          {!loadingDocs && <span className="text-xs text-secondary">{documents.length} elementi</span>}
        </div>

        {loadingDocs ? (
          <div className="p-6 text-secondary">Caricamento…</div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-secondary">Nessun documento generato.</div>
        ) : (
          <div className="cs-list">
            {documents.map((d) => (
              <div key={d.id} className="cs-list-item">
                <div className="flex-1">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-secondary mt-1">
                    Stato: {d.status}{d.file_url ? ' • PDF pronto' : ' • PDF da creare'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => handlePreviewHtml(d)}>Anteprima</button>
                  {!d.file_url && (
                    <button className="cs-btn cs-btn--accent cs-btn--sm" onClick={() => void handleCreatePdf(d)}>Crea PDF</button>
                  )}
                  {d.file_url && (
                    <>
                      <button className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => handleDownloadPdf(d)}>Scarica PDF</button>
                      <button className="cs-btn cs-btn--primary cs-btn--sm" onClick={() => handleAttachToMessage(d)}>Allega a messaggio…</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showTemplateModal && (
        <TemplateModal
          mode={editingTemplate ? 'edit' : 'create'}
          initialTemplate={editingTemplate ?? undefined}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null) }}
          onSaved={async () => { setShowTemplateModal(false); setEditingTemplate(null); await loadTemplates() }}
        />
      )}

      {showBulkModal && selectedTemplate && (
        <BulkGenerateModal
          template={selectedTemplate}
          onClose={() => { setShowBulkModal(false); setSelectedTemplate(null) }}
          onGenerated={async () => { setShowBulkModal(false); setSelectedTemplate(null) }}
          onPreview={(html) => setPreviewHtml(html)}
        />
      )}

      {previewHtml && (
        <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}

      {/* Modal messaggi per allegare PDF */}
      {showMessageModal && (
        <MessageModal
          open={showMessageModal}
          onClose={() => { setShowMessageModal(false); setMessageDraft(null) }}
          message={messageDraft}
          teams={teams}
          users={users}
          onCreate={handleCreateMessage}
          onUpdate={handleUpdateMessage}
        />
      )}
    </div>
  )
}
