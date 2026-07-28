'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const completeAuth = async () => {
      const supabase = createClient()
      const url = new URL(window.location.href)
      const next = safeNextPath(url.searchParams.get('next'))
      const code = url.searchParams.get('code')

      if (code) {
        // createBrowserClient() from @supabase/ssr automatically detects and
        // exchanges a PKCE `code` in the URL. Calling exchangeCodeForSession
        // here would consume the one-time code twice and always fail.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) {
          setError('Il link di autenticazione non è valido o è scaduto.')
          return
        }
      } else {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (!accessToken || !refreshToken) {
          setError('Il link di invito non contiene una sessione valida.')
          return
        }

        // Handle the implicit-flow fragment explicitly. Do not call
        // getSession() first: createBrowserClient also inspects the URL and
        // waiting for its automatic detector here can leave this page stuck.
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          setError('La sessione del link di invito non è valida o è scaduta.')
          return
        }
      }

      // Remove tokens from the address bar before navigating away.
      window.history.replaceState({}, document.title, '/auth/callback')
      window.location.replace(next)
    }

    completeAuth().catch(() => setError('Errore durante la verifica del link di invito.'))
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="cs-card max-w-lg text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Link non valido</h1>
            <p className="mt-3 text-secondary">{error}</p>
            <a className="cs-btn cs-btn--primary mt-6 inline-flex" href="/login">
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
