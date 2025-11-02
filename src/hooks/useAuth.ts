'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ProfileRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'athlete' | string
  must_change_password: boolean | null
  created_at: string | null
  updated_at: string | null
  // aggiungi qui altri campi se servono
}

interface UseAuthReturn {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  role: string | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  // Evita refetch multipli dello stesso profilo
  const lastProfileFor = useRef<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Deriva un ruolo “risolto” con fallback al JWT, normalizzato
  const role = useMemo(() => {
    const raw =
      profile?.role ??
      (user as any)?.app_metadata?.role ??
      (user as any)?.user_metadata?.role ??
      null
    if (raw == null) return null
    return String(raw).trim().toLowerCase()
  }, [profile?.role, user])

  // Debug opzionale: abilita su Vercel con NEXT_PUBLIC_DEBUG_ROLE=1
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_DEBUG_ROLE) return
    // Non loggare dati sensibili; giusto due info utili di debug
    // eslint-disable-next-line no-console
    console.log('[useAuth] role debug', {
      roleFromProfile: profile?.role,
      roleFromAppMeta: (user as any)?.app_metadata?.role,
      roleFromUserMeta: (user as any)?.user_metadata?.role,
      resolvedRole: role,
    })
  }, [profile?.role, user, role])

  const loadProfile = async (uid: string) => {
    if (!uid) return
    // evita richieste duplicate
    if (lastProfileFor.current === uid) return
    lastProfileFor.current = uid

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    if (!mounted.current) return
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[useAuth] profiles select error', error)
      setProfile(null)
      return
    }
    setProfile(data as ProfileRow)
  }

  const refreshProfile = async () => {
    if (user?.id) {
      // consenti refetch forzando l’ID “ultimo”
      lastProfileFor.current = null
      await loadProfile(user.id)
    }
  }

  useEffect(() => {
    let unsub: (() => void) | null = null

    const init = async () => {
      // 1) sessione iniziale
      const { data, error } = await supabase.auth.getSession()
      if (!mounted.current) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[useAuth] getSession error', error)
      }
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)

      if (data.session?.user?.id) {
        // carica il profilo dell’utente corrente e attendi prima di marcare loading=false
        await loadProfile(data.session.user.id)
      } else {
        setProfile(null)
      }

      // 2) subscribe ai cambi di auth
      const { data: sub } = supabase.auth.onAuthStateChange(async (event, _session) => {
        if (!mounted.current) return
        setLoading(true)
        setSession(_session ?? null)
        setUser(_session?.user ?? null)

        if (_session?.user?.id) {
          // resetta e ricarica il profilo quando cambia utente
          lastProfileFor.current = null
          await loadProfile(_session.user.id)
        } else {
          setProfile(null)
        }
        if (mounted.current) setLoading(false)
      })
      unsub = () => sub.subscription.unsubscribe()

      setLoading(false)
    }

    init().catch((e) => {
    if (!mounted.current) return
    // evita di applicare una risposta obsoleta se l'UID è cambiato durante la fetch
    if (lastProfileFor.current !== uid) return
      // eslint-disable-next-line no-console
      console.error('[useAuth] init unexpected error', e)
      setLoading(false)
    })

    return () => {
      unsub?.()
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    // pulizia locale
    setUser(null)
    setSession(null)
    setProfile(null)
    lastProfileFor.current = null
  }

  return { user, session, profile, role, loading, refreshProfile, signOut }
}
