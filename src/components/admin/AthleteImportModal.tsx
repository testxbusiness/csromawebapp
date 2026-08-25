'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminModal from './AdminModal'
import { importFromExcel, athleteImportColumns, type ImportResult } from '@/lib/utils/excelImport'
import type { Season } from './athleteTypes'
import type { AthleteImportRow } from '@/lib/validation/profiles'

interface AthleteImportModalProps {
  isOpen: boolean
  seasons: Season[]
  onComplete: () => void
  onClose: () => void
}

type ImportResponse = {
  success: boolean
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; membership_number: string; error: string }>
}

const templateHeaders = ['Nome', 'Cognome', 'Numero Tessera', 'Email', 'Telefono', 'Data Nascita', 'Attività', 'Squadra', 'Numero Maglia', 'Scadenza Certificato', 'Note']

export default function AthleteImportModal({ isOpen, seasons, onComplete, onClose }: AthleteImportModalProps) {
  const [seasonId, setSeasonId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult<AthleteImportRow> | null>(null)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const activeSeasonId = useMemo(
    () => seasons.find((season) => season.is_active)?.id || seasons[0]?.id || '',
    [seasons]
  )

  useEffect(() => {
    if (!isOpen) return
    setSeasonId((current) => current || activeSeasonId)
    setFile(null)
    setPreview(null)
    setResult(null)
  }, [isOpen, activeSeasonId])

  const downloadTemplate = () => {
    const sample = ['Mario', 'Rossi', 'TESSERA-001', '', '', '2010-01-15', '', '', '', '', '']
    const csv = [templateHeaders, sample].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'template_import_atleti_csroma.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (selectedFile: File | null) => {
    setFile(selectedFile)
    setResult(null)
    if (!selectedFile) {
      setPreview(null)
      return
    }
    const parsed = await importFromExcel<AthleteImportRow>(selectedFile, athleteImportColumns, { maxRows: 1000 })
    setPreview(parsed)
  }

  const handleImport = async () => {
    if (!seasonId || !preview?.data.length || loading) return
    setLoading(true)
    try {
      const response = await fetch('/api/admin/athletes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: seasonId, rows: preview.data }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Importazione non riuscita')
      setResult(payload)
      if (payload.created || payload.updated) onComplete()
    } catch (error) {
      setResult({ success: false, totalRows: preview.data.length, created: 0, updated: 0, skipped: preview.data.length, errors: [{ row: 0, membership_number: '', error: error instanceof Error ? error.message : 'Errore di rete' }] })
    } finally {
      setLoading(false)
    }
  }

  const parserErrors = preview?.errors || []
  const canImport = Boolean(seasonId && preview?.data.length && !loading)

  return (
    <AdminModal isOpen={isOpen} title="Importa Atleti" onClose={onClose} sizeClassName="max-w-5xl">
      <div className="space-y-5">
        <div className="cs-alert cs-alert--info">
          Il numero tessera è obbligatorio e identifica la persona anche nelle stagioni successive. L’import non crea account di accesso.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="athlete-import-season" className="cs-field__label">Stagione *</label>
            <select id="athlete-import-season" className="cs-select" value={seasonId} onChange={(event) => setSeasonId(event.target.value)} required>
              <option value="" disabled>Seleziona una stagione</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.is_active ? ' (Attiva)' : ''}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={downloadTemplate} className="cs-btn cs-btn--outline">Scarica modello CSV</button>
          </div>
        </div>

        <div>
          <label htmlFor="athlete-import-file" className="cs-field__label">File XLSX o CSV *</label>
          <input id="athlete-import-file" type="file" accept=".xlsx,.xls,.csv" className="cs-input" onChange={(event) => void handleFile(event.target.files?.[0] || null)} />
          <p className="text-xs text-secondary mt-1">Colonne minime: Nome, Cognome, Numero Tessera. Squadra può contenere codice o nome.</p>
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="cs-badge cs-badge--neutral">Righe: {preview.totalRows}</span>
              <span className="cs-badge cs-badge--success">Valide: {preview.validRows}</span>
              {parserErrors.length > 0 && <span className="cs-badge cs-badge--danger">Errori: {parserErrors.length}</span>}
            </div>
            {parserErrors.length > 0 && (
              <div className="cs-alert cs-alert--warning max-h-32 overflow-y-auto">
                {parserErrors.map((error) => <div key={error}>{error}</div>)}
              </div>
            )}
            {preview.data.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="cs-table">
                  <thead><tr><th>Nome</th><th>Cognome</th><th>Numero Tessera</th><th>Attività</th><th>Squadra</th></tr></thead>
                  <tbody>{preview.data.slice(0, 8).map((row) => <tr key={`${row.membership_number}-${row.first_name}-${row.last_name}`}><td>{row.first_name}</td><td>{row.last_name}</td><td>{row.membership_number}</td><td>{row.activity_name || '—'}</td><td>{row.team_code || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className={result.success ? 'cs-alert cs-alert--success' : 'cs-alert cs-alert--warning'}>
            <div><strong>{result.success ? 'Importazione completata' : 'Importazione completata con segnalazioni'}</strong></div>
            <div>Nuovi: {result.created} · Aggiornati: {result.updated} · Righe rifiutate: {result.skipped}</div>
            {result.errors.length > 0 && <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">{result.errors.map((error) => <div key={`${error.row}-${error.membership_number}`}>Riga {error.row}: {error.error}</div>)}</div>}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="cs-btn cs-btn--ghost">Chiudi</button>
          <button type="button" onClick={() => void handleImport()} disabled={!canImport} className="cs-btn cs-btn--primary">
            {loading ? 'Importazione...' : 'Importa righe valide'}
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
