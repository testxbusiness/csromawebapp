'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextPath = useMemo(() => {
    const raw = searchParams?.get('next') || '/dashboard'
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/_next') && !raw.startsWith('/api')) {
      return raw
    }
    return '/dashboard'
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j?.error || 'Credenziali non valide')
        return
      }

      const j = await res.json()

      if (j?.profile && j?.user) {
        try {
          sessionStorage.setItem(
            'csroma_profile_cache',
            JSON.stringify({
              data: j.profile,
              timestamp: Date.now(),
              userId: j.user.id,
            })
          )
          console.log('Profile cached during login')
        } catch (err) {
          console.warn('Failed to cache profile:', err)
        }
      }

      if (j?.user) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        router.push(nextPath)
      }
    } catch (err) {
      setError('Si è verificato un errore durante il login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      <Image src="/images/volleyball-net.jpg" alt="" fill priority className="object-cover" />
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.25)' }} />

      <main className="relative z-10 flex min-h-screen items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg md:max-w-xl">
          <div className="cs-card cs-card--primary" style={{ padding: 24 }}>
            <div className="text-center" style={{ marginBottom: 16 }}>
              <img src="/images/logo_CSRoma.svg" alt="CSRoma" className="h-16 mx-auto mb-2" />
              <h1 className="text-2xl font-bold">CSRoma WebApp</h1>
              <p className="text-secondary text-base">Accedi per continuare</p>
            </div>

            {error && (
              <div className="cs-alert cs-alert--danger" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="cs-field">
                <label htmlFor="email" className="cs-field__label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="cs-input"
                  placeholder="la.tua@email.com"
                />
              </div>

              <div className="cs-field">
                <label htmlFor="password" className="cs-field__label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="cs-input"
                  placeholder="La tua password"
                />
              </div>

              <button type="submit" disabled={loading} className="cs-btn cs-btn--primary cs-btn--block">
                {loading ? 'Accesso in corso…' : 'Accedi'}
              </button>
            </form>

            <div className="text-center" style={{ marginTop: 12 }}>
              <Link href="/reset-password" className="text-sm text-secondary underline">
                Hai dimenticato la password?
              </Link>
            </div>
            <div className="text-center text-secondary text-xs" style={{ marginTop: 8 }}>
              Per creare un account contatta l'amministratore.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
