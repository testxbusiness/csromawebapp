'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { importFromExcel, userImportColumns, eventImportColumns, teamMemberImportColumns, ImportResult } from '@/lib/utils/excelImport'

interface ImportManagerProps {
  type: 'users' | 'events' | 'team-members'
  onComplete?: () => void
}

interface ImportedUser {
  first_name: string
  last_name: string
  email: string
  phone_number?: string
  date_of_birth?: string
  role: 'admin' | 'coach' | 'athlete'
}

interface ImportedEvent {
  title: string
  description?: string
  location?: string
  start_date: string
  start_time: string
  end_time: string
  team_codes: string[]
}

interface ImportedTeamMember {
  email: string
  team_code: string
  jersey_number?: number
  membership_number?: string
  medical_certificate_expiry?: string
}

type ImportedData = ImportedUser | ImportedEvent | ImportedTeamMember

export default function ImportManager({ type, onComplete }: ImportManagerProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult<ImportedData> | null>(null)
  const [previewData, setPreviewData] = useState<ImportedData[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const supabase = createClient()

  const getColumnDefinitions = () => {
    switch (type) {
      case 'users':
        return userImportColumns
      case 'events':
        return eventImportColumns
      case 'team-members':
        return teamMemberImportColumns
      default:
        return {}
    }
  }

  const getTypeLabel = () => {
    switch (type) {
      case 'users':
        return 'Utenti'
      case 'events':
        return 'Eventi'
      case 'team-members':
        return 'Membri Squadra'
      default:
        return 'Dati'
    }
  }

  const getTemplateData = () => {
    switch (type) {
      case 'users':
        return [
          ['Nome', 'Cognome', 'Email', 'Telefono', 'Data Nascita', 'Ruolo'],
          ['Mario', 'Rossi', 'mario.rossi@email.com', '+39 123 456 7890', '1990-01-15', 'athlete'],
          ['Lucia', 'Bianchi', 'lucia.bianchi@email.com', '+39 098 765 4321', '1985-05-20', 'coach']
        ]
      case 'events':
        return [
          ['Titolo', 'Descrizione', 'Luogo', 'Data Inizio', 'Ora Inizio', 'Ora Fine', 'Codici Squadre'],
          ['Allenamento', 'Allenamento settimanale', 'Palestra Centro', '2024-01-15', '18:00', '20:00', 'U16M,U18F'],
          ['Partita', 'Partita campionato', 'Campo Sportivo', '2024-01-20', '15:00', '17:00', 'SENIORM']
        ]
      case 'team-members':
        return [
          ['Email', 'Codice Squadra', 'Numero Maglia', 'Numero Tessera', 'Scadenza Certificato'],
          ['mario.rossi@email.com', 'U16M', '10', 'T12345', '2024-12-31'],
          ['lucia.bianchi@email.com', 'U18F', '7', 'T12346', '2024-11-30']
        ]
      default:
        return []
    }
  }

  const downloadTemplate = () => {
    const templateData = getTemplateData()
    const csvContent = templateData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${type}_csroma.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportResult(null)
    setShowPreview(false)

    // Preview first few rows
    try {
      const previewResult = await importFromExcel<ImportedData>(
        selectedFile,
        getColumnDefinitions(),
        { maxRows: 5 }
      )
      setPreviewData(previewResult.data)
      if (previewResult.data.length > 0) {
        setShowPreview(true)
      }
    } catch (error) {
      console.error('Preview error:', error)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    try {
      const result = await importFromExcel<ImportedData>(
        file,
        getColumnDefinitions(),
        { maxRows: 1000 }
      )

      setImportResult(result)

      if (result.success && result.data.length > 0) {
        await processImportedData(result.data)
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportResult({
        success: false,
        data: [],
        errors: [`Errore durante l'importazione: ${error}`],
        totalRows: 0,
        validRows: 0
      })
    }
    setImporting(false)
  }

  const processImportedData = async (data: ImportedData[]) => {
    try {
      switch (type) {
        case 'users':
          await importUsers(data as ImportedUser[])
          break
        case 'events':
          await importEvents(data as ImportedEvent[])
          break
        case 'team-members':
          await importTeamMembers(data as ImportedTeamMember[])
          break
      }
    } catch (error) {
      console.error('Database import error:', error)
      setImportResult(prev => prev ? {
        ...prev,
        success: false,
        errors: [...prev.errors, `Errore database: ${error}`]
      } : null)
    }
  }

  const importUsers = async (users: ImportedUser[]) => {
    // Sposta la logica lato server per evitare l'uso di Admin API nel client
    const response = await fetch('/api/admin/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    })
    const result = await response.json()
    if (!response.ok || !result?.success) {
      const msg = result?.error || 'Errore import utenti lato server'
      throw new Error(msg)
    }
  }

  const importEvents = async (events: ImportedEvent[]) => {
    for (const event of events) {
      // Create event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{
          title: event.title,
          description: event.description,
          location: event.location,
          start_time: `${event.start_date}T${event.start_time}:00`,
          end_time: `${event.start_date}T${event.end_time}:00`,
          is_recurring: false
        }])
        .select()
        .single()

      if (eventError) {
        throw new Error(`Errore creazione evento ${event.title}: ${eventError.message}`)
      }

      // Associate with teams
      if (event.team_codes && event.team_codes.length > 0) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .in('code', event.team_codes)

        if (teams && teams.length > 0) {
          const eventTeams = teams.map(team => ({
            event_id: eventData.id,
            team_id: team.id
          }))

          await supabase
            .from('event_teams')
            .insert(eventTeams)
        }
      }
    }
  }

  const importTeamMembers = async (members: ImportedTeamMember[]) => {
    for (const member of members) {
      // Find user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', member.email)
        .single()

      if (!profile) {
        throw new Error(`Utente non trovato: ${member.email}`)
      }

      // Find team by code
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('code', member.team_code)
        .single()

      if (!team) {
        throw new Error(`Squadra non trovata: ${member.team_code}`)
      }

      // Upsert athlete profile extras
      const { error: athleteError } = await supabase
        .from('athlete_profiles')
        .upsert({
          profile_id: profile.id,
          membership_number: member.membership_number || null,
          medical_certificate_expiry: member.medical_certificate_expiry || null
        })

      if (athleteError) {
        throw new Error(`Errore salvataggio dati atleta per ${member.email}: ${athleteError.message}`)
      }

      // Create team membership (jersey number only)
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          profile_id: profile.id,
          team_id: team.id,
          jersey_number: member.jersey_number
        }])

      if (memberError) {
        throw new Error(`Errore aggiunta membro ${member.email}: ${memberError.message}`)
      }
    }
  }

  return (
    <div className="cs-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Import {getTypeLabel()}</h2>
        <button onClick={downloadTemplate} className="cs-btn cs-btn--outline cs-btn--sm">
          Scarica Template
        </button>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleziona file Excel/CSV
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          Formati supportati: .xlsx, .xls, .csv (massimo 1000 righe)
        </p>
      </div>

      {/* Preview */}
      {showPreview && previewData.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">Anteprima Dati (prime 5 righe)</h3>
          <div className="cs-card">
            {/* Desktop */}
            <div className="hidden md:block">
            <table className="cs-table">
              <thead>
                <tr>
                  {Object.keys(previewData[0]).map(key => (
                    <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {key.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 text-sm text-gray-900">
                        {String(value || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2">
              {previewData.map((row, index) => (
                <div key={index} className="cs-card">
                  {Object.entries(row).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <strong>{key.replace('_',' ')}:</strong> <span className="text-secondary">{String(value || '')}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && (
        <div className="mb-6">
          <button onClick={handleImport} disabled={importing} className="cs-btn cs-btn--primary">
            {importing ? 'Importazione in corso...' : `Importa ${getTypeLabel()}`}
          </button>
        </div>
      )}

      {/* Results */}
      {importResult && (
        <div className="cs-card p-4">
          <div className={`font-medium mb-2 ${importResult.success ? '' : ''}`}>
            {importResult.success ? '✅ Importazione completata' : '❌ Importazione fallita'}
          </div>
          
          <div className="text-sm text-gray-600 space-y-1">
            <div>Righe totali: {importResult.totalRows}</div>
            <div>Righe valide: {importResult.validRows}</div>
            <div>Righe con errori: {importResult.totalRows - importResult.validRows}</div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-red-600 mb-2">Errori riscontrati:</h4>
              <div className="cs-alert cs-alert--danger max-h-40 overflow-y-auto">
                {importResult.errors.map((error, index) => (
                  <div key={index} className="text-sm">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult.success && onComplete && (
            <button onClick={onComplete} className="mt-4 cs-btn cs-btn--primary cs-btn--sm">
              Chiudi e Ricarica
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 cs-card">
        <h3 className="font-medium mb-2">Istruzioni per l'Import</h3>
        <div className="text-sm text-secondary space-y-1">
          <div>1. Scarica il template Excel usando il pulsante "Scarica Template"</div>
          <div>2. Compila il template con i tuoi dati seguendo il formato</div>
          <div>3. Salva il file e caricalo qui</div>
          <div>4. Controlla l'anteprima e procedi con l'importazione</div>
        </div>
        
        {type === 'users' && (
          <div className="mt-3 text-sm text-blue-700">
            <strong>Nota:</strong> Gli utenti importati riceveranno una password temporanea che dovranno cambiare al primo accesso.
          </div>
        )}
      </div>
    </div>
  )
}
