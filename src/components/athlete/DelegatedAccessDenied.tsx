'use client'

import Link from 'next/link'
import { FeedbackState } from '@/components/ui/FeedbackState'

export default function DelegatedAccessDenied({
  section,
  profileName,
}: {
  section: string
  profileName?: string
}) {
  const profileSuffix = profileName ? ` per ${profileName}` : ''

  return (
    <FeedbackState
      variant="denied"
      title="Accesso non abilitato"
      description={`Non hai il permesso di visualizzare ${section}${profileSuffix}. L’amministratore può modificare i permessi della relazione.`}
      action={(
        <Link href="/dashboard" className="cs-btn cs-btn--outline inline-flex">
          Torna alla dashboard
        </Link>
      )}
      className="cs-card cs-card--primary cs-card--lg"
    />
  )
}
