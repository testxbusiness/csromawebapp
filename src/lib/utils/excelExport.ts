import * as XLSX from 'xlsx'

export interface ExcelExportOptions {
  filename: string
  sheetName?: string
  headerStyle?: Partial<XLSX.CellStyle>
  dataStyle?: Partial<XLSX.CellStyle>
}

const defaultHeaderStyle: XLSX.CellStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4472C4' } },
  alignment: { horizontal: 'center', vertical: 'center' }
}

const defaultDataStyle: XLSX.CellStyle = {
  font: { name: 'Arial', sz: 11 },
  alignment: { vertical: 'center' }
}

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: Array<{
    key: keyof T
    title: string
    width?: number
    format?: (value: any) => string
  }>,
  options: ExcelExportOptions
) {
  // Prepara i dati
  const worksheetData = [
    columns.map(col => col.title), // Intestazioni
    ...data.map(item => 
      columns.map(col => {
        const value = item[col.key]
        return col.format ? col.format(value) : value
      })
    )
  ]

  // Crea il worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData)

  // Applica stili alle celle
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  
  // Stile intestazioni
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[cellAddress]) ws[cellAddress] = {}
    ws[cellAddress].s = { ...defaultHeaderStyle, ...options.headerStyle }
  }

  // Stile dati
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[cellAddress]) {
        ws[cellAddress].s = { ...defaultDataStyle, ...options.dataStyle }
      }
    }
  }

  // Imposta larghezze colonne
  ws['!cols'] = columns.map(col => ({
    width: col.width || 15,
    wpx: col.width ? col.width * 7 : 100
  }))

  // Crea workbook e scarica
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Dati')
  
  XLSX.writeFile(wb, `${options.filename}.xlsx`)
}

// Utility specifiche per CSRoma
export const userExportColumns = [
  { key: 'first_name', title: 'Nome', width: 15 },
  { key: 'last_name', title: 'Cognome', width: 15 },
  { key: 'email', title: 'Email', width: 25 },
  { key: 'role', title: 'Ruolo', width: 12 },
  { key: 'phone', title: 'Telefono', width: 15 },
  { key: 'date_of_birth', title: 'Data Nascita', width: 12, format: (val) => val ? new Date(val).toLocaleDateString('it-IT') : '' },
  { key: 'jersey_number', title: 'N. Maglia', width: 10 },
  { key: 'membership_number', title: 'N. Tessera', width: 15 },
  { key: 'medical_certificate_expiry', title: 'Scad. Cert. Medico', width: 15, format: (val) => val ? new Date(val).toLocaleDateString('it-IT') : '' },
  { key: 'teams', title: 'Squadre', width: 20, format: (val) => val?.map((t: any) => t.name).join(', ') || '' },
  { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
]

export const teamExportColumns = [
  { key: 'name', title: 'Nome Squadra', width: 20 },
  { key: 'code', title: 'Codice', width: 12 },
  { key: 'activities', title: 'Attività', width: 15, format: (val) => val?.name || '' },
  { key: 'coach', title: 'Allenatore', width: 20, format: (val) => val ? `${val.first_name} ${val.last_name}` : '' },
  { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
]

export const seasonExportColumns = [
  { key: 'name', title: 'Nome Stagione', width: 20 },
  { key: 'start_date', title: 'Data Inizio', width: 12, format: (val) => new Date(val).toLocaleDateString('it-IT') },
  { key: 'end_date', title: 'Data Fine', width: 12, format: (val) => new Date(val).toLocaleDateString('it-IT') },
  { key: 'is_active', title: 'Stato', width: 10, format: (val) => val ? 'Attiva' : 'Inattiva' },
  { key: 'created_at', title: 'Data Creazione', width: 15, format: (val) => new Date(val).toLocaleDateString('it-IT') }
]

// Funzioni di export pronte all'uso
export function exportUsers(users: any[], filename: string = 'utenti_csroma') {
  exportToExcel(users, userExportColumns, {
    filename,
    sheetName: 'Utenti',
    headerStyle: { fill: { fgColor: { rgb: '2E75B6' } } }
  })
}

export function exportTeams(teams: any[], filename: string = 'squadre_csroma') {
  exportToExcel(teams, teamExportColumns, {
    filename,
    sheetName: 'Squadre',
    headerStyle: { fill: { fgColor: { rgb: '70AD47' } } }
  })
}

export function exportSeasons(seasons: any[], filename: string = 'stagioni_csroma') {
  exportToExcel(seasons, seasonExportColumns, {
    filename,
    sheetName: 'Stagioni',
    headerStyle: { fill: { fgColor: { rgb: 'FFC000' } } }
  })
}

const documentTemplateExportColumns = [
  { key: 'name', title: 'Nome Template' },
  { key: 'description', title: 'Descrizione' },
  { key: 'type', title: 'Tipo' },
  { key: 'target_type', title: 'Target' },
  { key: 'is_active', title: 'Attivo' },
  { key: 'has_logo', title: 'Ha Logo' },
  { key: 'has_date', title: 'Ha Data' },
  { key: 'has_signature_area', title: 'Area Firma' },
  { key: 'created_at', title: 'Data Creazione' }
]

const documentExportColumns = [
  { key: 'title', title: 'Titolo' },
  { key: 'document_type', title: 'Tipo Documento' },
  { key: 'status', title: 'Stato' },
  { key: 'target_user_name', title: 'Utente Target' },
  { key: 'target_team_name', title: 'Team Target' },
  { key: 'generation_date', title: 'Data Generazione' },
  { key: 'created_at', title: 'Data Creazione' }
]

export function exportDocumentTemplates(templates: any[], filename: string = 'template_documenti_csroma') {
  const processedData = templates.map(template => ({
    ...template,
    type: template.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    target_type: template.target_type === 'user' ? 'Utente' : 'Team',
    is_active: template.is_active ? 'Sì' : 'No',
    has_logo: template.has_logo ? 'Sì' : 'No',
    has_date: template.has_date ? 'Sì' : 'No',
    has_signature_area: template.has_signature_area ? 'Sì' : 'No',
    created_at: template.created_at ? new Date(template.created_at).toLocaleDateString('it-IT') : ''
  }))

  exportToExcel(processedData, documentTemplateExportColumns, {
    filename,
    sheetName: 'Template Documenti',
    headerStyle: { fill: { fgColor: { rgb: 'E74C3C' } } }
  })
}

export function exportDocuments(documents: any[], filename: string = 'documenti_csroma') {
  const processedData = documents.map(document => ({
    ...document,
    document_type: document.document_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    status: document.status === 'generated' ? 'Generato' :
             document.status === 'sent' ? 'Inviato' :
             document.status === 'archived' ? 'Archiviato' : 'Bozza',
    target_user_name: document.target_user ? 
      `${document.target_user.first_name} ${document.target_user.last_name}` : '',
    target_team_name: document.target_team?.name || '',
    generation_date: document.generation_date ? 
      new Date(document.generation_date).toLocaleDateString('it-IT') : '',
    created_at: document.created_at ? new Date(document.created_at).toLocaleDateString('it-IT') : ''
  }))

  exportToExcel(processedData, documentExportColumns, {
    filename,
    sheetName: 'Documenti',
    headerStyle: { fill: { fgColor: { rgb: 'E74C3C' } } }
  })
}

const eventExportColumns = [
  { key: 'title', title: 'Titolo', width: 25 },
  { key: 'description', title: 'Descrizione', width: 30 },
  { key: 'location', title: 'Luogo', width: 20 },
  { key: 'start_time', title: 'Data/Ora Inizio', width: 18, format: (val) => new Date(val).toLocaleString('it-IT') },
  { key: 'end_time', title: 'Data/Ora Fine', width: 18, format: (val) => new Date(val).toLocaleString('it-IT') },
  { key: 'is_recurring', title: 'Ricorrente', width: 12, format: (val) => val ? 'Sì' : 'No' },
  { key: 'teams', title: 'Squadre', width: 25, format: (val) => Array.isArray(val) ? val.join(', ') : val || '' }
]

export function exportEvents(events: any[], filename: string = 'eventi_csroma') {
  exportToExcel(events, eventExportColumns, {
    filename,
    sheetName: 'Eventi',
    headerStyle: { fill: { fgColor: { rgb: '9B59B6' } } }
  })
}