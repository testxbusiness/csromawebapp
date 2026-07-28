import { Button, Input, Modal } from '@/components/ui'

interface MatchResultModalProps {
  open: boolean
  description: string
  value: string
  saving: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
}

export function MatchResultModal({
  open,
  description,
  value,
  saving,
  onOpenChange,
  onChange,
  onCancel,
  onSave,
}: MatchResultModalProps) {
  return (
    <Modal
      fullscreenOnMobile
      open={open}
      onOpenChange={onOpenChange}
      title="Modifica risultato"
      description={description}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Inserisci i set separati da virgola (es: 25-20, 25-21, 28-26)</p>
        <Input
          placeholder="25-20, 25-21, 28-26"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Annulla</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface MatchInfoForm {
  match_date: string
  start_time: string
  location_text: string
}

interface MatchInfoModalProps {
  open: boolean
  description: string
  form: MatchInfoForm
  saving: boolean
  onOpenChange: (open: boolean) => void
  onChange: (form: MatchInfoForm) => void
  onCancel: () => void
  onSave: () => void
}

export function MatchInfoModal({
  open,
  description,
  form,
  saving,
  onOpenChange,
  onChange,
  onCancel,
  onSave,
}: MatchInfoModalProps) {
  return (
    <Modal
      fullscreenOnMobile
      open={open}
      onOpenChange={onOpenChange}
      title="Modifica info gara"
      description={description}
    >
      <div className="space-y-3">
        <div>
          <label className="cs-label">Data</label>
          <Input
            type="date"
            value={form.match_date}
            onChange={(event) => onChange({ ...form, match_date: event.target.value })}
          />
        </div>
        <div>
          <label className="cs-label">Ora</label>
          <Input
            type="time"
            value={form.start_time}
            onChange={(event) => onChange({ ...form, start_time: event.target.value })}
          />
        </div>
        <div>
          <label className="cs-label">Luogo</label>
          <Input
            value={form.location_text}
            onChange={(event) => onChange({ ...form, location_text: event.target.value })}
            placeholder="Palestra / indirizzo"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Annulla</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
