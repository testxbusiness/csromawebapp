'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { captureSupabaseError, captureUnexpectedServerError } from '@/lib/sentry/server-capture'

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/api') ||
    value === '/auth/callback'
  ) {
    return '/reset-password?recovery=1'
  }
  return value
}

function hasSupabaseError(url: URL) {
  return ['error', 'error_code', 'error_description'].some((key) => url.searchParams.has(key))
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const initialUrlRef = useRef<URL | null>(null)
  const processingRef = useRef(false)

  if (initialUrlRef.current === null && typeof window !== 'undefined') {
    // Capture the callback before the Auth provider's SDK initialization can
    // exchange a PKCE code and remove it from the address bar.
    initialUrlRef.current = new URL(window.location.href)
  }

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    const completeAuth = async () => {
      const initialUrl = initialUrlRef.current ?? new URL(window.location.href)
      const next = safeNextPath(initialUrl.searchParams.get('next'))
      const originalCode = initialUrl.searchParams.get('code')
      const originalError = hasSupabaseError(initialUrl)
      const originalHash = new URLSearchParams(initialUrl.hash.replace(/^#/, ''))
      const accessToken = originalHash.get('access_token')
      const refreshToken = originalHash.get('refresh_token')

      if (originalError) {
        setError('Il link è scaduto, è già stato utilizzato o non è valido. Puoi richiedere un nuovo link di recupero password.')
        return
      }

      const supabase = createClient()

      if (originalCode) {
        // The shared SSR browser client owns the PKCE exchange. Awaiting
        // getSession also waits for its URL detection to finish. A successful
        // exchange removes `code`; if it remains, do not accept an unrelated
        // session that may already have existed in this browser.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const codeStillPresent = new URL(window.location.href).searchParams.has('code')
        if (sessionError || !session || codeStillPresent) {
          if (sessionError) captureSupabaseError(sessionError, 'auth', 'login', 'client', false)
          setError('Il link di recupero non è valido o è scaduto. Richiedi un nuovo link per continuare.')
          return
        }
      } else if (accessToken && refreshToken) {
        // The shared browser client detects implicit tokens during the same
        // initialization as PKCE. Wait for it instead of calling setSession,
        // which would race the SDK and consume the same callback twice.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const remainingHash = new URLSearchParams(new URL(window.location.href).hash.replace(/^#/, ''))
        if (sessionError || !session || remainingHash.has('access_token') || remainingHash.has('refresh_token')) {
          if (sessionError) captureSupabaseError(sessionError, 'auth', 'login', 'client', false)
          setError('Il link non è valido o è scaduto. Per recuperare la password, richiedi un nuovo link.')
          return
        }
      } else {
        // No callback credential means an existing browser session is not
        // evidence that this link was verified.
        setError('Il link è assente o non valido. Per recuperare la password, richiedi un nuovo link.')
        return
      }

      // Remove credentials from the visible URL before leaving the callback.
      window.history.replaceState({}, document.title, '/auth/callback')
      window.location.replace(next)
    }

    completeAuth().catch((caught) => {
      captureUnexpectedServerError(caught, 'auth', 'login', 'client')
      setError('Non è stato possibile verificare il link. Per recuperare la password, richiedi un nuovo link.')
    })
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="cs-card max-w-lg text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Link non valido</h1>
            <p className="mt-3 text-secondary">{error}</p>
            <a className="cs-btn cs-btn--primary mt-6 inline-flex" href="/forgot-password">
              Richiedi un nuovo link
            </a>
            <a className="cs-btn mt-3 inline-flex" href="/login">
              Torna al login
            </a>
          </>
        ) : (
          <p>Verifica del link in corso…</p>
        )}
      </div>
    </main>
  )
}
