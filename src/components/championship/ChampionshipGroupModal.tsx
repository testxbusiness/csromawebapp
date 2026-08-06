'use client'

import { Button, Input, Modal, Select } from '@/components/ui'

interface ChampionshipGroupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  phase: string
  onNameChange: (name: string) => void
  onPhaseChange: (phase: string) => void
  saving: boolean
  onCreate: () => void | Promise<void>
}

export function ChampionshipGroupModal({ open, onOpenChange, name, phase, onNameChange, onPhaseChange, saving, onCreate }: ChampionshipGroupModalProps) {
  return (
    <Modal fullscreenOnMobile open={open} onOpenChange={onOpenChange} title="Aggiungi girone" description="Crea un nuovo girone per il campionato selezionato.">
      <div className="space-y-3">
        <div>
          <label className="cs-label">Nome</label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Girone B" />
        </div>
        <div>
          <label className="cs-label">Fase</label>
          <Select value={phase} onChange={(e) => onPhaseChange(e.target.value)}>
            <option value="regular">Regular</option>
            <option value="playoff">Playoff</option>
            <option value="playout">Playout</option>
            <option value="cup">Coppa</option>
            <option value="friendly">Amichevole</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={onCreate} disabled={saving}>{saving ? 'Salvataggio...' : 'Crea girone'}</Button>
        </div>
      </div>
    </Modal>
  )
}
