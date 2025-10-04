'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isMandatoryChange, setIsMandatoryChange] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const nextPath = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    const checkMandatoryChange = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('id', session.user.id)
          .single()

        const mustChange =
          session.user.user_metadata?.must_change_password === true ||
          profile?.must_change_password === true

        setIsMandatoryChange(mustChange)
      }
    }
    checkMandatoryChange()
  }, [supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Le password non coincidono')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      if (isMandatoryChange) {
        await supabase.auth.updateUser({
          data: {
            must_change_password: false,
            temp_password_set_at: null,
            temp_password_expires_at: null,
          },
        })
        // aggiorna profilo via API (se presente)
        await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ must_change_password: false }),
        }).catch(() => {})
      }

      setMessage('Password aggiornata con successo! Reindirizzamento…')
      setTimeout(() => {
        router.push(isMandatoryChange ? nextPath : '/login')
      }, 1000)
    } catch {
      setError('Errore durante il reset della password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Sfondo a tutta pagina (stesso della login) */}
      <Image
        src="/images/sfondo_pagina_login.jpg"
        alt=""
        fill
        priority
        className="object-cover"
      />
      {/* Velo per contrasto */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.25)' }} />

      {/* Contenuto centrato */}
      <main className="relative z-10 flex min-h-screen items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg md:max-w-xl">
          <div className="cs-card" style={{ padding: 24 }}>
            {/* Header con logo (coerente con login) */}
            <div className="text-center" style={{ marginBottom: 16 }}>
              <img
                src="/images/logo_CSRoma.svg"
                alt="CSRoma"
                className="h-16 mx-auto mb-2"
              />
              <h1 className="text-2xl font-bold">
                {isMandatoryChange ? 'Imposta Nuova Password' : 'Reimposta Password'}
              </h1>
              <p className="text-secondary text-base">
                {isMandatoryChange
                  ? 'Benvenuto! Per continuare, imposta una nuova password per il tuo account.'
                  : 'Inserisci e conferma la nuova password.'}
              </p>
            </div>

            {/* Messaggi */}
            {error && (
              <div className="cs-alert cs-alert--danger" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}
            {message && (
              <div className="cs-alert cs-alert--success" style={{ marginBottom: 12 }}>
                {message}
              </div>
            )}

            {/* Form */}
            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div className="cs-field">
                <label htmlFor="password" className="cs-field__label">Nuova Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  className="cs-input"
                  placeholder="Inserisci la nuova password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="cs-field">
                <label htmlFor="confirmPassword" className="cs-field__label">Conferma Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  className="cs-input"
                  placeholder="Conferma la nuova password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cs-btn cs-btn--primary cs-btn--block"
              >
                {loading
                  ? (isMandatoryChange ? 'Impostando…' : 'Reimpostando…')
                  : (isMandatoryChange ? 'Imposta Password' : 'Reimposta Password')}
              </button>
            </form>

            {!isMandatoryChange && (
              <div className="text-center" style={{ marginTop: 12 }}>
                <Link href="/login" className="text-sm text-secondary underline">
                  Torna al Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
