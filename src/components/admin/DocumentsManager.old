'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportDocumentTemplates, exportDocuments } from '@/lib/utils/excelExport'
import { generatePDF, replaceTemplateVariables, getTemplateVariables, generateBulkDocuments, downloadPDF } from '@/lib/utils/pdfGenerator'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle, CardActions } from '@/components/ui/Card'
import { Table, TableActions } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Input, Field } from '@/components/ui/Input'

interface DocumentTemplate {
  id: string
  name: string
  description?: string
  type: 'medical_certificate_request' | 'enrollment_form' | 'attendance_certificate' | 'payment_receipt' | 'team_convocation'
  target_type: 'user' | 'team'
  content_html: string
  styles_css?: string
  has_logo: boolean
  logo_position: 'top-left' | 'top-center' | 'top-right'
  has_date: boolean
  date_format: string
  has_signature_area: boolean
  footer_text?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
}

interface Document {
  id: string
  template_id?: string
  title: string
  description?: string
  document_type: string
  status: 'draft' | 'generated' | 'sent' | 'archived'
  generated_content_html?: string
  file_url?: string
  file_name?: string
  target_user_id?: string
  target_team_id?: string
  generation_date?: string
  variables: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string

  // Joined data
  template?: {
    name: string
  }
  target_user?: {
    first_name: string
    last_name: string
  }
  target_team?: {
    name: string
  }
}

interface Team {
  id: string
  name: string
  code: string
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  role: string
}

export default function DocumentsManager() {
  const [activeTab, setActiveTab] = useState<'templates' | 'documents'>('templates')
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [showDocumentForm, setShowDocumentForm] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showBulkGeneration, setShowBulkGeneration] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [bulkRecipients, setBulkRecipients] = useState<any[]>([])
  const [generatingBulk, setGeneratingBulk] = useState(false)
  const [showDocumentGeneration, setShowDocumentGeneration] = useState(false)
  const [selectedGenerationTemplate, setSelectedGenerationTemplate] = useState<DocumentTemplate | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadTemplates(),
      loadDocuments(),
      loadTeams(),
      loadProfiles()
    ])
    setLoading(false)
  }

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTemplates(data)
  }

  const loadDocuments = async () => {
    try {
      // Prima carica i documenti base
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })

      if (documentsError) {
        console.error('Error loading documents:', documentsError)
        return
      }

      if (!documentsData) {
        setDocuments([])
        return
      }

      // Carica i template associati
      const templateIds = documentsData.map(doc => doc.template_id).filter(Boolean)
      let templatesMap: Record<string, { id: string; name: string }> = {}
      if (templateIds.length > 0) {
        const { data: templatesData } = await supabase
          .from('document_templates')
          .select('id, name')
          .in('id', templateIds)

        if (templatesData) {
          templatesMap = templatesData.reduce((acc, template) => {
            acc[template.id] = template
            return acc
          }, {} as Record<string, { id: string; name: string }>)
        }
      }

      // Carica i profili utente target
      const userIds = documentsData.map(doc => doc.target_user_id).filter(Boolean)
      let usersMap: Record<string, { id: string; first_name: string; last_name: string }> = {}
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds)

        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.id] = user
            return acc
          }, {} as Record<string, { id: string; first_name: string; last_name: string }>)
        }
      }

      // Carica le squadre target
      const teamIds = documentsData.map(doc => doc.target_team_id).filter(Boolean)
      let teamsMap: Record<string, { id: string; name: string }> = {}
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds)

        if (teamsData) {
          teamsMap = teamsData.reduce((acc, team) => {
            acc[team.id] = team
            return acc
          }, {} as Record<string, { id: string; name: string }>)
        }
      }

      // Combina tutti i dati
      const transformedData = documentsData.map(doc => ({
        ...doc,
        template: doc.template_id && templatesMap[doc.template_id] ? { name: templatesMap[doc.template_id].name } : null,
        target_user: doc.target_user_id && usersMap[doc.target_user_id] ? {
          first_name: usersMap[doc.target_user_id].first_name,
          last_name: usersMap[doc.target_user_id].last_name
        } : null,
        target_team: doc.target_team_id && teamsMap[doc.target_team_id] ? { name: teamsMap[doc.target_team_id].name } : null
      }))

      setDocuments(transformedData)
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, code')
      .order('name')
    if (data) setTeams(data)
  }

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .order('first_name')
    if (data) setProfiles(data)
  }

  const saveTemplate = async (template: Partial<DocumentTemplate>) => {
    try {
      if (editingTemplate && editingTemplate.id) {
        // UPDATE existing template
        const { error } = await supabase
          .from('document_templates')
          .update(template)
          .eq('id', editingTemplate.id)
        if (error) throw error
      } else {
        // INSERT new template (remove id field for new templates)
        const { id, ...templateWithoutId } = template
        const { error } = await supabase
          .from('document_templates')
          .insert([templateWithoutId])
        if (error) throw error
      }

      setEditingTemplate(null)
      setShowTemplateForm(false)
      loadTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const saveDocument = async (document: Partial<Document>) => {
    try {
      if (editingDocument) {
        const { error } = await supabase
          .from('documents')
          .update(document)
          .eq('id', editingDocument.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('documents')
          .insert([document])
        if (error) throw error
      }
      
      setEditingDocument(null)
      setShowDocumentForm(false)
      loadDocuments()
    } catch (error) {
      console.error('Error saving document:', error)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo template?')) {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id)
      if (!error) loadTemplates()
    }
  }

  const deleteDocument = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo documento?')) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
      if (!error) loadDocuments()
    }
  }

  const generateDocument = async (templateId: string, targetId: string, targetType: 'user' | 'team') => {
    try {
      const template = templates.find(t => t.id === templateId)
      if (!template) return

      // Get template variables based on target type
      let variables = {}
      if (targetType === 'user') {
        const user = profiles.find(p => p.id === targetId)
        if (user) {
          variables = {
            user_first_name: user.first_name,
            user_last_name: user.last_name,
            user_full_name: `${user.first_name} ${user.last_name}`,
            user_title: user.role === 'admin' ? 'Dott.' : 'Sig.'
          }
        }
      } else {
        const team = teams.find(t => t.id === targetId)
        if (team) {
          variables = {
            team_name: team.name,
            team_code: team.code
          }
        }
      }

      // Replace template variables
      let generatedContent = template.content_html
      Object.entries(variables).forEach(([key, value]) => {
        generatedContent = generatedContent.replace(
          new RegExp(`{{${key}}}`, 'g'),
          String(value)
        )
      })

      const newDocument = {
        template_id: templateId,
        title: `${template.name} - ${targetType === 'user' ? variables.user_full_name : variables.team_name}`,
        document_type: template.type,
        status: 'generated' as const,
        generated_content_html: generatedContent,
        target_user_id: targetType === 'user' ? targetId : null,
        target_team_id: targetType === 'team' ? targetId : null,
        generation_date: new Date().toISOString(),
        variables
      }

      await saveDocument(newDocument)
    } catch (error) {
      console.error('Error generating document:', error)
    }
  }

  const previewTemplate = (template: DocumentTemplate) => {
    let preview = template.content_html
    
    // Replace common variables with placeholder values
    const placeholders = {
      user_first_name: 'Mario',
      user_last_name: 'Rossi',
      user_full_name: 'Mario Rossi',
      user_title: 'Sig.',
      team_name: 'Team Esempio',
      team_code: 'TE01',
      event_title: 'Allenamento',
      event_date: '01/01/2024',
      event_time: '18:00',
      event_location: 'Palestra Centro',
      coach_name: 'Allenatore Esempio'
    }

    Object.entries(placeholders).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value)
    })

    setPreviewContent(preview)
    setShowPreview(true)
  }

  const generateSinglePDF = async (template: DocumentTemplate) => {
    try {
      const placeholders = {
        user_first_name: 'Mario',
        user_last_name: 'Rossi', 
        user_full_name: 'Mario Rossi',
        user_title: 'Sig.',
        team_name: 'Team Esempio',
        team_code: 'TE01',
        current_date: new Date().toLocaleDateString('it-IT')
      }

      const content = replaceTemplateVariables(template.content_html, placeholders)
      
      const pdf = await generatePDF({
        title: template.name,
        content,
        styles: template.styles_css,
        hasLogo: template.has_logo,
        logoPosition: template.logo_position,
        hasDate: template.has_date,
        hasSignatureArea: template.has_signature_area,
        footerText: template.footer_text
      })

      downloadPDF(pdf)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Errore nella generazione del PDF')
    }
  }

  const startBulkGeneration = async (template: DocumentTemplate) => {
    setSelectedTemplate(template)

    // Load recipients based on template type
    let recipients = []
    if (template.target_type === 'user') {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id, first_name, last_name, email, phone, date_of_birth,
          athlete_profiles(membership_number, medical_certificate_expiry),
          team_members(jersey_number, teams(name, code, activities(name)))
        `)
        .eq('role', 'athlete')

      recipients = data || []
    } else {
      const { data } = await supabase
        .from('teams')
        .select(`
          id, name, code,
          activities(name),
          team_coaches(profiles(first_name, last_name, email)),
          team_members(profiles(first_name, last_name, email))
        `)

      recipients = data || []
    }

    setBulkRecipients(recipients)
    setShowBulkGeneration(true)
  }

  const generateBulkPDFs = async (selectedRecipients: any[]) => {
    if (!selectedTemplate) return
    
    setGeneratingBulk(true)
    try {
      const getVariablesForRecipient = (recipient: any) => {
        if (selectedTemplate.target_type === 'user') {
          const teamInfo = recipient.team_members?.[0]
          const athleteProfile = recipient.athlete_profiles?.[0] || recipient.athlete_profiles || recipient.athlete_profile
          return {
            user_first_name: recipient.first_name,
            user_last_name: recipient.last_name,
            user_full_name: `${recipient.first_name} ${recipient.last_name}`,
            user_email: recipient.email,
            user_phone: recipient.phone,
            user_birth_date: recipient.date_of_birth,
            user_title: 'Sig.',
            jersey_number: teamInfo?.jersey_number,
            membership_number: athleteProfile?.membership_number,
            medical_certificate_expiry: athleteProfile?.medical_certificate_expiry,
            team_name: teamInfo?.team?.name,
            team_code: teamInfo?.team?.code,
            activity_name: teamInfo?.team?.activity?.name,
            current_date: new Date().toLocaleDateString('it-IT')
          }
        } else {
          const coachProfile = recipient.team_coaches?.[0]?.profiles
          return {
            team_name: recipient.name,
            team_code: recipient.code,
            activity_name: recipient.activity?.name,
            coach_name: coachProfile ? `${coachProfile.first_name} ${coachProfile.last_name}` : '',
            coach_email: coachProfile?.email,
            current_date: new Date().toLocaleDateString('it-IT')
          }
        }
      }

      const pdfs = await generateBulkDocuments(
        selectedTemplate,
        selectedRecipients,
        getVariablesForRecipient
      )

      // Create documents in database
      for (let i = 0; i < pdfs.length; i++) {
        const pdf = pdfs[i]
        const recipient = selectedRecipients[i]
        const variables = getVariablesForRecipient(recipient)
        
        const newDocument = {
          template_id: selectedTemplate.id,
          title: `${selectedTemplate.name} - ${variables.user_full_name || variables.team_name}`,
          document_type: selectedTemplate.type,
          status: 'generated' as const,
          generated_content_html: replaceTemplateVariables(selectedTemplate.content_html, variables),
          target_user_id: selectedTemplate.target_type === 'user' ? recipient.id : null,
          target_team_id: selectedTemplate.target_type === 'team' ? recipient.id : null,
          generation_date: new Date().toISOString(),
          variables
        }

        await saveDocument(newDocument)
      }

      // Download all PDFs as zip (simplified - in production you'd create a zip file)
      pdfs.forEach((pdf, index) => {
        setTimeout(() => downloadPDF(pdf), index * 500) // Stagger downloads
      })

      alert(`${pdfs.length} documenti generati con successo!`)
      setShowBulkGeneration(false)
      loadDocuments()
    } catch (error) {
      console.error('Error generating bulk PDFs:', error)
      alert('Errore nella generazione dei documenti')
    }
    setGeneratingBulk(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="cs-skeleton cs-skeleton--circle w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="cs-tabs">
          <button
            onClick={() => setActiveTab('templates')}
            className="cs-tab"
            aria-selected={activeTab === 'templates'}
          >
            Template Documenti
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className="cs-tab"
            aria-selected={activeTab === 'documents'}
          >
            Documenti Generati
          </button>
        </div>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Template Documenti</h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => exportDocumentTemplates(templates)}
                variant="accent"
              >
                Esporta Excel
              </Button>
              <Button
                onClick={() => {
                  setEditingTemplate(null)
                  setShowTemplateForm(true)
                }}
                variant="primary"
              >
                Nuovo Template
              </Button>
            </div>
          </div>

          {templates.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[color:var(--cs-text-secondary)] mb-4">Nessun template creato</p>
              <Button
                onClick={() => setShowTemplateForm(true)}
                variant="primary"
              >
                Crea il tuo primo template
              </Button>
            </Card>
          ) : (
            <Card variant='primary'>
              <Table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Target</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <div>
                          <div className="text-sm font-medium text-[color:var(--cs-text)]">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-[color:var(--cs-text-secondary)]">{template.description}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        {template.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </td>
                      <td>
                        {template.target_type === 'user' ? 'Utente' : 'Team'}
                      </td>
                      <td>
                        <Badge variant={template.is_active ? 'success' : 'danger'}>
                          {template.is_active ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </td>
                      <td>
                        <TableActions>
  <button
    onClick={() => previewTemplate(template)}
    className="cs-btn cs-btn--outline cs-btn--sm"
  >
    Anteprima
  </button>

  <button
    onClick={() => {
      setEditingTemplate(template)
      setShowTemplateForm(true)
    }}
    className="cs-btn cs-btn--outline cs-btn--sm"
  >
    Modifica
  </button>

  <button
    onClick={() => deleteTemplate(template.id)}
    className="cs-btn cs-btn--danger cs-btn--sm"
  >
    Elimina
  </button>
</TableActions>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Documenti Generati</h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => exportDocuments(documents)}
                variant="accent"
              >
                Esporta Excel
              </Button>
              <Button
                onClick={() => setShowDocumentGeneration(true)}
                variant="primary"
              >
                Genera Documento
              </Button>
            </div>
          </div>

          {documents.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-[color:var(--cs-text-secondary)] mb-4">Nessun documento generato</p>
              <p className="text-sm text-[color:var(--cs-text-secondary)]">Seleziona un template per generare il primo documento</p>
            </Card>
          ) : (
            <Card variant='primary'>
              <Table>
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th>Tipo</th>
                    <th>Target</th>
                    <th>Stato</th>
                    <th>Data Generazione</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="text-sm font-medium text-[color:var(--cs-text)]">{document.title}</div>
                        {document.description && (
                          <div className="text-sm text-[color:var(--cs-text-secondary)]">{document.description}</div>
                        )}
                      </td>
                      <td>
                        {document.document_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </td>
                      <td>
                        {document.target_user_id
                          ? `${document.target_user?.first_name} ${document.target_user?.last_name}`
                          : document.target_team?.name
                        }
                      </td>
                      <td>
                        <Badge variant={
                          document.status === 'generated' ? 'success' :
                          document.status === 'sent' ? 'info' :
                          document.status === 'archived' ? 'neutral' : 'warning'
                        }>
                          {document.status === 'generated' ? 'Generato' :
                           document.status === 'sent' ? 'Inviato' :
                           document.status === 'archived' ? 'Archiviato' : 'Bozza'}
                        </Badge>
                      </td>
                      <td>
                        {document.generation_date
                          ? new Date(document.generation_date).toLocaleDateString('it-IT')
                          : '-'
                        }
                      </td>
                      <td>
                        <TableActions>
  {document.generated_content_html && (
    <button
      onClick={() => {
        setPreviewContent(document.generated_content_html!)
        setShowPreview(true)
      }}
      className="cs-btn cs-btn--outline cs-btn--sm"
    >
      Visualizza
    </button>
  )}

  <button
    onClick={() => deleteDocument(document.id)}
    className="cs-btn cs-btn--danger cs-btn--sm"
  >
    Elimina
  </button>
</TableActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="cs-overlay" aria-hidden="false">
          <div className="cs-modal">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[color:var(--cs-text)]">
                {editingTemplate ? 'Modifica Template' : 'Nuovo Template'}
              </h3>
              <button
                onClick={() => {
                  setShowTemplateForm(false)
                  setEditingTemplate(null)
                }}
                className="cs-btn cs-btn--ghost cs-btn--icon"
              >
                <span className="cs-sr-only">Chiudi</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Nome Template *">
                <Input
                  type="text"
                  placeholder="Inserisci nome template"
                  value={editingTemplate?.name || ''}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, name: e.target.value })
                    } else {
                      setEditingTemplate({ name: e.target.value, type: 'medical_certificate_request', target_type: 'user', content_html: '', has_logo: false, logo_position: 'top-left', has_date: true, date_format: 'dd/mm/yyyy', has_signature_area: true, is_active: true } as DocumentTemplate)
                    }
                  }}
                />
              </Field>

              <Field label="Descrizione">
                <textarea
                  className="cs-textarea"
                  rows={2}
                  placeholder="Descrizione del template"
                  value={editingTemplate?.description || ''}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, description: e.target.value })
                    }
                  }}
                />
              </Field>

              <div className="cs-grid cs-grid--2">
                <Field label="Tipo Documento *">
                  <select
                    className="cs-select"
                    value={editingTemplate?.type || 'medical_certificate_request'}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, type: e.target.value as any })
                      }
                    }}
                  >
                    <option value="medical_certificate_request">Richiesta Certificato Medico</option>
                    <option value="enrollment_form">Modulo Iscrizione</option>
                    <option value="attendance_certificate">Attestato Frequenza</option>
                    <option value="payment_receipt">Ricevuta Pagamento</option>
                    <option value="team_convocation">Convocazione Squadra</option>
                  </select>
                </Field>

                <Field label="Target *">
                  <select
                    className="cs-select"
                    value={editingTemplate?.target_type || 'user'}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, target_type: e.target.value as 'user' | 'team' })
                      }
                    }}
                  >
                    <option value="user">Utente Singolo</option>
                    <option value="team">Squadra</option>
                  </select>
                </Field>
              </div>

              <Field label="Contenuto HTML *">
                <textarea
                  className="cs-textarea font-mono text-sm"
                  rows={8}
                  placeholder="Inserisci il contenuto HTML del template. Usa {{variabile}} per le variabili dinamiche."
                  value={editingTemplate?.content_html || ''}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, content_html: e.target.value })
                    }
                  }}
                />
                <p className="cs-help">
                  Variabili disponibili: user_first_name, user_last_name, user_full_name, user_title, team_name, team_code, event_title, event_date, event_time, event_location, coach_name
                </p>
              </Field>

              <div className="cs-grid cs-grid--2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--cs-border)] text-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)]"
                    checked={editingTemplate?.has_logo || false}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, has_logo: e.target.checked })
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-[color:var(--cs-text)]">Includi Logo</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--cs-border)] text-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)]"
                    checked={editingTemplate?.has_date || true}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, has_date: e.target.checked })
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-[color:var(--cs-text)]">Includi Data</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--cs-border)] text-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)]"
                    checked={editingTemplate?.has_signature_area || true}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, has_signature_area: e.target.checked })
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-[color:var(--cs-text)]">Area Firma</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--cs-border)] text-[color:var(--cs-primary)] focus:ring-[color:var(--cs-primary)]"
                    checked={editingTemplate?.is_active || true}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })
                      }
                    }}
                  />
                  <span className="ml-2 text-sm text-[color:var(--cs-text)]">Template Attivo</span>
                </label>
              </div>

              <Field label="Testo Footer">
                <Input
                  type="text"
                  placeholder="Testo da mostrare nel footer"
                  value={editingTemplate?.footer_text || ''}
                  onChange={(e) => {
                    if (editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, footer_text: e.target.value })
                    }
                  }}
                />
              </Field>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowTemplateForm(false)
                  setEditingTemplate(null)
                }}
                variant="outline"
              >
                Annulla
              </Button>
              <Button
                onClick={() => {
                  const templateToSave = editingTemplate || { name: '', content_html: '' } as DocumentTemplate
                  if (templateToSave.name && templateToSave.content_html) {
                    saveTemplate(templateToSave)
                  } else {
                    alert('Compila tutti i campi obbligatori: Nome e Contenuto HTML')
                  }
                }}
                variant="primary"
              >
                {editingTemplate ? 'Salva Modifiche' : 'Crea Template'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Generation Modal */}
      {showDocumentGeneration && (
        <div className="cs-overlay" aria-hidden="false">
          <div className="cs-modal">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[color:var(--cs-text)]">Genera Documento</h3>
              <button
                onClick={() => {
                  setShowDocumentGeneration(false)
                  setSelectedGenerationTemplate(null)
                  setSelectedTargetId('')
                }}
                className="cs-btn cs-btn--ghost cs-btn--icon"
              >
                <span className="cs-sr-only">Chiudi</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Seleziona Template *">
                <select
                  className="cs-select"
                  value={selectedGenerationTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value)
                    setSelectedGenerationTemplate(template || null)
                  }}
                >
                  <option value="" disabled>Seleziona un template...</option>
                  {templates.filter(t => t.is_active).map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.target_type === 'user' ? 'Utente' : 'Team'})
                    </option>
                  ))}
                </select>
              </Field>

              {selectedGenerationTemplate && (
                <Field label={`${selectedGenerationTemplate.target_type === 'user' ? 'Seleziona Utente' : 'Seleziona Squadra'} *`}>
                  <select
                    className="cs-select"
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                  >
                    <option value="" disabled>Seleziona {selectedGenerationTemplate.target_type === 'user' ? 'utente' : 'squadra'}...</option>
                    {selectedGenerationTemplate.target_type === 'user' ? (
                      profiles
                        .filter(p => p.role === 'athlete')
                        .map(user => (
                          <option key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </option>
                        ))
                    ) : (
                      teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.name} ({team.code})
                        </option>
                      ))
                    )}
                  </select>
                </Field>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowDocumentGeneration(false)
                  setSelectedGenerationTemplate(null)
                  setSelectedTargetId('')
                }}
                variant="outline"
              >
                Annulla
              </Button>
              <Button
                onClick={() => {
                  if (selectedGenerationTemplate && selectedTargetId) {
                    generateDocument(
                      selectedGenerationTemplate.id,
                      selectedTargetId,
                      selectedGenerationTemplate.target_type
                    )
                    setShowDocumentGeneration(false)
                    setSelectedGenerationTemplate(null)
                    setSelectedTargetId('')
                  } else {
                    alert('Seleziona un template e un target')
                  }
                }}
                variant="primary"
                disabled={!selectedGenerationTemplate || !selectedTargetId}
              >
                Genera Documento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="cs-overlay" aria-hidden="false">
          <div className="cs-modal cs-modal--lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[color:var(--cs-text)]">Anteprima Documento</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="cs-btn cs-btn--ghost cs-btn--icon"
              >
                <span className="cs-sr-only">Chiudi</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              className="cs-card max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => setShowPreview(false)}
                variant="outline"
              >
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
