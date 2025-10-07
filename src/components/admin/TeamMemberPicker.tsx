'use client'

export type TeamMember = {
  id: string
  first_name?: string
  last_name?: string
  email?: string
  jersey_number?: number | null
  selected?: boolean
}

export default function TeamMemberPicker({
  members, onToggle, onToggleAll
}:{
  members: TeamMember[]
  onToggle: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
}) {
  return (
    <div className="cs-card p-3">
      <div className="flex justify-between mb-2">
        <div className="text-sm font-medium">Atleti ({members.length})</div>
        <div className="flex gap-2">
          <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => onToggleAll(true)}>Seleziona tutti</button>
          <button className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => onToggleAll(false)}>Deseleziona</button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.selected} onChange={(e) => onToggle(m.id, e.target.checked)} />
            <span>
              {(m.last_name || '').toUpperCase()} {m.first_name}
              {m.jersey_number ? <span className="text-secondary"> #{m.jersey_number}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
