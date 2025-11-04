'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client' // se nel tuo client.ts esporti "supabase" di default, cambia in: import supabase from '@/lib/supabase/client'

type Props = { nextPath: string }

export default function ResetPasswordForm({ nextPath }: Props) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isMandatoryChange, setIsMandatoryChange] = useState(false)

  const router = useRouter()
  const supabase = createClient() // se importi "supabase" default, rimuovi questa riga e usa direttamente "supabase"

  useEffect(() => {
    const checkMandatoryChange = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

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
        // Aggiorna i metadati dell'utente (JWT) per disattivare il flag
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            must_change_password: false,
            temp_password_set_at: null,
            temp_password_expires_at: null,
          },
        })
        if (metaErr) {
          console.warn('Errore aggiornamento metadati utente:', metaErr)
        }
        // Sincronizza anche il profilo applicativo
        // opzionale: sincronizza profilo via API interna, se esiste
        fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ must_change_password: false }),
        }).catch(() => {})

        // Forza un refresh della sessione per aggiornare il JWT usato dal middleware
        try { await supabase.auth.refreshSession() } catch {}
      }

      setMessage('Password aggiornata con successo! Reindirizzamento…')
      // Imposta cookie bypass per consentire 1 navigazione al di fuori di /reset-password
      try { document.cookie = 'csr_pw_reset=1; path=/; max-age=60' } catch {}

      // Reindirizza dopo un breve delay per mostrare il messaggio di successo
      setTimeout(() => {
        router.replace(isMandatoryChange ? nextPath : '/login')
      }, 1500)
    } catch {
      setError('Errore durante il reset della password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Sfondo a tutta pagina (coerente con la login) */}
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
          <div className="cs-card cs-card--primary" style={{ padding: 24 }}>
            {/* Header con logo */}
            <div className="text-center" style={{ marginBottom: 16 }}>
              {/* Se vuoi evitare il warning <img>, usa sempre <Image /> */}
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
