'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client' // se nel tuo client.ts esporti "supabase" di default, cambia in: import supabase from '@/lib/supabase/client'

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_RESET === '1'
const dbg = (...args: any[]) => { if (DEBUG) { try { console.warn(...args) } catch {} } }

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
      dbg('[ResetPassword] checkMandatoryChange: start')
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
      dbg('[ResetPassword] checkMandatoryChange: mustChange =', mustChange)
    }
    checkMandatoryChange()
  }, [supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    dbg('[ResetPassword] handleResetPassword: start')

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
      // Chiamiamo una route server-side che usa l'Admin API per aggiornare password + metadati
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = j?.error || 'Errore nel reset della password'
        dbg('[ResetPassword] api reset-password failed:', msg)
        setError(msg)
        setLoading(false)
        return
      }

      // Best-effort: refresh della sessione per aggiornare localmente il JWT
      try { await supabase.auth.refreshSession() } catch {}

      setMessage('Password aggiornata con successo! Reindirizzamento…')

      // Imposta cookie bypass per consentire 1 navigazione al di fuori di /reset-password
      try {
        document.cookie = 'csr_pw_reset=1; path=/; max-age=60'
        dbg('Cookie csr_pw_reset impostato')
      } catch (cookieError) {
        dbg('Errore impostazione cookie:', cookieError)
      }

      // Piccola attesa per assicurare che il cookie sia inviato nella prossima navigazione
      await new Promise((r) => setTimeout(r, 50))

      dbg('[ResetPassword] redirect: target =', isMandatoryChange ? nextPath : '/login')

      // Per cambi password obbligatori, usa window.location per evitare conflitti con middleware
      if (isMandatoryChange) {
        dbg('[ResetPassword] mandatory-change: navigating with window.location.replace')
        window.location.replace(isMandatoryChange ? nextPath : '/login')
        // Safety: se per qualsiasi motivo la navigazione non avviene, ferma loading dopo 3s e mostra link
        setTimeout(() => {
          try {
            if (window.location.pathname === '/reset-password') {
              dbg('[ResetPassword] fallback: replace did not navigate within 3s')
              setLoading(false)
              setError('Reindirizzamento non riuscito. Usa il link qui sotto per continuare.')
            }
          } catch {}
        }, 3000)
        return // Non continuare con React state updates dopo il redirect
      }

      // Per reset password normale, usa router.replace
      try {
        router.replace('/login')
        console.log('Router redirect chiamato con successo')
      } catch (redirectError) {
        console.error('Errore nel redirect:', redirectError)
        setLoading(false)
        setError('Errore nel reindirizzamento. Ricarica la pagina.')
      }

    } catch (error) {
      console.error('Errore durante il reset della password:', error)
      setError('Errore durante il reset della password')
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
