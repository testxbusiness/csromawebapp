'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (resetError) {
      setError('Non è stato possibile inviare la richiesta. Riprova tra poco.')
    } else {
      // Keep the response neutral: do not reveal whether the email exists.
      setSubmitted(true)
    }

    setLoading(false)
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
              <h1 className="text-2xl font-bold">Recupera password</h1>
              <p className="text-secondary text-base">
                Inserisci l&apos;email associata al tuo account.
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4">
                <div className="cs-alert cs-alert--success">
                  Se l&apos;indirizzo è registrato, riceverai un&apos;email con le istruzioni per reimpostare la password.
                </div>
                <p className="text-secondary text-sm text-center">
                  Controlla anche la cartella spam. Il link ha una validità limitata.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="cs-alert cs-alert--danger">{error}</div>}

                <div className="cs-field">
                  <label htmlFor="forgot-email" className="cs-field__label">Email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="cs-input"
                    placeholder="la.tua@email.com"
                  />
                </div>

                <button type="submit" disabled={loading} className="cs-btn cs-btn--primary cs-btn--block">
                  {loading ? 'Invio in corso…' : 'Invia link di recupero'}
                </button>
              </form>
            )}

            <div className="text-center" style={{ marginTop: 16 }}>
              <Link href="/login" className="text-sm text-secondary underline">
                Torna al login
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
