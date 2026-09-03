'use client'

import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'

export function SubjectSwitcher({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { profiles, selectedProfileId, setSelectedProfileId, activeArea, loading } = useAccessibleProfiles()
  if (!loading && profiles.length === 0) return null

  const id = `subject-switcher-${variant}`
  return (
    <div className={variant === 'mobile' ? 'cs-subject-switcher cs-subject-switcher--mobile' : 'cs-subject-switcher'} aria-label="Selettore soggetto">
      <label htmlFor={id}>Stai visualizzando</label>
      <select id={id} className="cs-select min-h-11 max-w-full py-2 text-sm" value={selectedProfileId ?? ''} onChange={(event) => setSelectedProfileId(event.target.value || null)} disabled={loading}>
        <option value="">{activeArea === 'family' ? 'Seleziona profilo' : 'Il mio profilo'}</option>
        {profiles.map((entry) => {
          const name = `${entry.profile.first_name} ${entry.profile.last_name}`.trim()
          return <option key={entry.profile.id} value={entry.profile.id}>{name || entry.profile.email || 'Profilo'}</option>
        })}
      </select>
    </div>
  )
}
