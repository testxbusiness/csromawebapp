'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="it">
      <body>
        <main>
          <h1>Si è verificato un errore</h1>
          <p>Ricarica la pagina per riprovare.</p>
          <button type="button" onClick={() => reset()}>Riprova</button>
        </main>
      </body>
    </html>
  )
}
