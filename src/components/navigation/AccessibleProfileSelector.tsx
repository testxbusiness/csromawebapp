'use client'

import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'

export default function AccessibleProfileSelector() {
  const { profiles, selectedProfileId, setSelectedProfileId, loading } = useAccessibleProfiles()

  if (!loading && profiles.length === 0) return null

  return (
    <div className="hidden min-w-0 items-center gap-2 md:flex" aria-label="Contesto profilo accessibile">
      <label htmlFor="accessible-profile-selector" className="sr-only">Stai operando per</label>
      <span className="hidden text-xs font-medium text-[color:var(--cs-text-secondary)] xl:inline">Stai operando per</span>
      <select
        id="accessible-profile-selector"
        className="cs-select max-w-[190px] min-h-11 py-2 text-sm"
        value={selectedProfileId ?? ''}
        onChange={(event) => setSelectedProfileId(event.target.value || null)}
        disabled={loading}
      >
        <option value="">Il mio profilo</option>
        {profiles.map((entry) => (
          <option key={entry.profile.id} value={entry.profile.id}>
            {entry.profile.first_name} {entry.profile.last_name}
          </option>
        ))}
      </select>
    </div>
  )
}
