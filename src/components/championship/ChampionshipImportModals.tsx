'use client'

import { Button, Input, Modal, Select } from '@/components/ui'
import type { ChampionshipGroup } from '@/components/championship/types'

interface ChampionshipImportModalBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ChampionshipGroup[]
  groupId: string | null
  onGroupChange: (groupId: string | null) => void
  onFileChange: (file: File | null) => void
  importing: boolean
  onImport: () => void | Promise<void>
  disabled?: boolean
}

export function ChampionshipCalendarImportModal({
  open,
  onOpenChange,
  groups,
  groupId,
  onGroupChange,
  onFileChange,
  importing,
  onImport,
  disabled = false,
}: ChampionshipImportModalBaseProps) {
  return (
    <Modal
      fullscreenOnMobile
      open={open}
      onOpenChange={onOpenChange}
      title="Importa calendario (Excel)"
      description="Colonne attese: giornata, data (YYYY-MM-DD), ora (HH:MM), casa, casa_nome, ospiti, ospiti_nome, luogo, note."
    >
      <div className="space-y-3">
        <div>
          <label className="cs-label">Girone</label>
          <Select value={groupId || ''} onChange={(e) => onGroupChange(e.target.value || null)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="cs-label">File Excel</label>
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        </div>
        <div className="text-sm text-slate-600">
          Usa i codici squadra presenti in anagrafica (colonna &quot;code&quot;). Le partite saranno sincronizzate con il calendario per le squadre CSRoma.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={onImport} disabled={importing || disabled}>
            {importing ? 'Importazione...' : 'Importa calendario'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ChampionshipResultsImportModal({
  open,
  onOpenChange,
  groups,
  groupId,
  onGroupChange,
  onFileChange,
  importing,
  onImport,
  disabled = false,
}: ChampionshipImportModalBaseProps) {
  return (
    <Modal
      fullscreenOnMobile
      open={open}
      onOpenChange={onOpenChange}
      title="Importa risultati (Excel)"
      description="Colonne attese: giornata, casa, ospiti, risultato_set (es: 25-20, 25-21, 23-25, 25-22)."
    >
      <div className="space-y-3">
        <div>
          <label className="cs-label">Girone</label>
          <Select value={groupId || ''} onChange={(e) => onGroupChange(e.target.value || null)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="cs-label">File Excel</label>
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        </div>
        <div className="text-sm text-slate-600">
          La partita viene trovata con la chiave: giornata + casa + ospiti (codici squadra).
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={onImport} disabled={importing || disabled}>
            {importing ? 'Importazione...' : 'Importa risultati'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
