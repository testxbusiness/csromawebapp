'use client'

import Link from 'next/link'

export default function DelegatedAccessDenied({
  section,
  profileName,
}: {
  section: string
  profileName?: string
}) {
  return (
    <section className="cs-card cs-card--primary cs-card--lg" role="alert">
      <h2 className="cs-card__title">Accesso non abilitato</h2>
      <p className="cs-card__description">
        Non hai il permesso di visualizzare {section}{profileName ? ` per ${profileName}` : ''}.
        L’amministratore può modificare i permessi della relazione.
      </p>
      <Link href="/dashboard" className="cs-btn cs-btn--outline mt-5 inline-flex">
        Torna alla dashboard
      </Link>
    </section>
  )
}
