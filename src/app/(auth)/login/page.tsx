'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); return }
      if (data.user) router.push('/dashboard')
    } catch {
      setError('Si è verificato un errore durante il login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Sfondo a tutta pagina */}
      <Image
        src="/images/volleyball-net.jpg"
        alt=""              // decorativo
        fill
        priority
        className="object-cover"
      />
      {/* Velo per contrasto testo */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.25)' }} />

      {/* Contenuto sopra lo sfondo */}
      <main className="relative z-10 flex min-h-screen items-center justify-center p-6 md:p-10">
        {/* Box a SINISTRA */}
        <div className="w-full max-w-lg md:max-w-xl"> {/* md ~ 480px → xl ~ 640px */}
          <div className="cs-card cs-card--primary" style={{ padding: 24 }}> {/* padding più generoso */}
            {/* Logo centrato */}
            <div className="text-center" style={{ marginBottom: 16 }}>
              <img
                src="/images/logo_CSRoma.svg"
                alt="CSRoma"
                className="h-16 mx-auto mb-2"
              />
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
                <label htmlFor="email" className="cs-field__label">Email</label>
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
                <label htmlFor="password" className="cs-field__label">Password</label>
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
              Per creare un account contatta l’amministratore.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
